import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import cors from 'cors';
import mediaRouter from './routes/media.route.js';
import authRouter from './routes/auth.route.js';
import { query } from './db.js';

const app = express();
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

const PORT = 3001;
const server = createServer(app);
const wss = new WebSocketServer({ server });

// In-memory session state
const sessions = new Map();

function broadcast(sessionId, message, excludeWs = null) {
  const session = sessions.get(sessionId);
  if (!session) return;

  const messageStr = JSON.stringify(message);
  session.clients.forEach(client => {
    if (client !== excludeWs && client.readyState === 1) {
      client.send(messageStr);
    }
  });
}

wss.on('connection', (ws) => {
  let currentSession = null;
  let peerId = null;

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'join': {
          const sessionId = message.sessionId || 'default-session';
          peerId = message.peerId;
          ws.peerId = peerId;

          // Try to load from memory first
          let session = sessions.get(sessionId);

          if (!session) {
            // Try to load from DB
            try {
              const res = await query('SELECT * FROM sessions WHERE id = $1', [sessionId]);
              if (res.rows.length > 0) {
                const dbSession = res.rows[0];
                session = {
                  id: sessionId,
                  clients: new Set(),
                  host: null, // Host will be re-assigned or loaded
                  mediaId: dbSession.r2_key,
                  password: dbSession.password,
                  version: 0,
                  state: dbSession.last_state || {
                    playing: false,
                    position: 0,
                    timestamp: Date.now()
                  }
                };
                sessions.set(sessionId, session);
              } else {
                // Create new session
                session = {
                  id: sessionId,
                  clients: new Set(),
                  host: null,
                  mediaId: message.mediaId || null,
                  password: message.password || null, // Set password on creation
                  version: 0,
                  state: {
                    playing: false,
                    position: 0,
                    timestamp: Date.now()
                  }
                };
                sessions.set(sessionId, session);

                // Save to DB
                await query(
                  'INSERT INTO sessions (id, r2_key, password, last_state) VALUES ($1, $2, $3, $4)',
                  [sessionId, session.mediaId, session.password, session.state]
                ).catch(err => console.error('DB session save error:', err));
              }
            } catch (err) {
              console.error('DB session load error:', err);
            }
          }

          if (!session) return;

          // Password verification
          if (session.password && session.password !== message.password && session.host !== peerId) {
            ws.send(JSON.stringify({
              type: 'error',
              code: 'password-required',
              message: 'This room is password protected'
            }));
            return;
          }

          session.clients.add(ws);
          currentSession = sessionId;

          if (!session.mediaId && message.mediaId) {
            session.mediaId = message.mediaId;
            await query('UPDATE sessions SET r2_key = $1 WHERE id = $2', [session.mediaId, sessionId]);
          }

          // First client becomes host
          if (!session.host) {
            session.host = peerId;
          }

          const peers = Array.from(session.clients)
            .map(c => c.peerId)
            .filter(Boolean);

          ws.send(JSON.stringify({
            type: 'session-state',
            sessionId,
            host: session.host,
            isHost: session.host === peerId,
            mediaId: session.mediaId,
            version: session.version,
            state: session.state,
            peers
          }));

          // Notify others about new peer
          broadcast(sessionId, {
            type: 'peer-joined',
            peerId,
            peers
          }, ws);

          break;
        }

        // WebRTC Signaling messages
        case 'webrtc-offer': {
          // Forward offer to target peer
          const session = sessions.get(currentSession);
          if (!session) break;

          const targetWs = Array.from(session.clients).find(
            c => c.peerId === message.targetPeerId
          );

          if (targetWs && targetWs.readyState === 1) {
            targetWs.send(JSON.stringify({
              type: 'webrtc-offer',
              offer: message.offer,
              fromPeerId: peerId
            }));
          }
          break;
        }

        case 'webrtc-answer': {
          // Forward answer to target peer
          const session = sessions.get(currentSession);
          if (!session) break;

          const targetWs = Array.from(session.clients).find(
            c => c.peerId === message.targetPeerId
          );

          if (targetWs && targetWs.readyState === 1) {
            targetWs.send(JSON.stringify({
              type: 'webrtc-answer',
              answer: message.answer,
              fromPeerId: peerId
            }));
          }
          break;
        }

        case 'webrtc-ice-candidate': {
          // Forward ICE candidate to target peer
          const session = sessions.get(currentSession);
          if (!session) break;

          const targetWs = Array.from(session.clients).find(
            c => c.peerId === message.targetPeerId
          );

          if (targetWs && targetWs.readyState === 1) {
            targetWs.send(JSON.stringify({
              type: 'webrtc-ice-candidate',
              candidate: message.candidate,
              fromPeerId: peerId
            }));
          }
          break;
        }

        case 'heartbeat': {
          ws.send(JSON.stringify({ type: 'heartbeat-ack' }));
          break;
        }

        case 'change-media': {
          const session = sessions.get(currentSession);
          if (session && session.host === peerId) {
            session.mediaId = message.mediaId;
            broadcast(currentSession, {
              type: 'media-changed',
              mediaId: message.mediaId
            });
            // Persist change
            query('UPDATE sessions SET r2_key = $1 WHERE id = $2', [message.mediaId, currentSession])
              .catch(err => console.error('DB update media error:', err));
          }
          break;
        }

        case 'sync-snapshot': {
          const session = sessions.get(currentSession);
          if (session && session.host === peerId) {
            const newState = {
              playing: message.playing,
              position: message.position,
              timestamp: message.timestamp
            };
            session.state = newState;
            // Persist state
            query('UPDATE sessions SET last_state = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(newState), currentSession])
              .catch(err => console.error('DB update state error:', err));
          }
          break;
        }
      }
    } catch (err) {
      console.error('Error handling message:', err);
    }
  });

  ws.on('close', () => {
    if (currentSession) {
      const session = sessions.get(currentSession);
      if (session) {
        session.clients.delete(ws);

        // Get remaining peer IDs
        const remainingPeers = Array.from(session.clients)
          .map(c => c.peerId)
          .filter(Boolean);

        // If host left, elect new host (highest peer ID)
        if (session.host === peerId && remainingPeers.length > 0) {
          const newHost = remainingPeers.sort().reverse()[0];
          session.host = newHost;

          broadcast(currentSession, {
            type: 'host-changed',
            newHost,
            peers: remainingPeers
          });
        }

        // Clean up empty sessions
        if (session.clients.size === 0) {
          sessions.delete(currentSession);
        } else {
          broadcast(currentSession, {
            type: 'peer-left',
            peerId,
            peers: remainingPeers
          });
        }
      }
    }
  });

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
});

app.use('/media', mediaRouter);
app.use('/api/auth', authRouter);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});