import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

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

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'join': {
          const sessionId = message.sessionId || 'default-session';
          peerId = message.peerId;
          ws.peerId = peerId;

          if (!sessions.has(sessionId)) {
            sessions.set(sessionId, {
              id: sessionId,
              clients: new Set(),
              host: null,
              version: 0,
              state: {
                playing: false,
                position: 0,
                timestamp: Date.now()
              }
            });
          }

          const session = sessions.get(sessionId);
          session.clients.add(ws);
          currentSession = sessionId;

          // First client becomes host
          if (!session.host) {
            session.host = peerId;
          }

          // Get list of all peer IDs
          const peers = Array.from(session.clients)
            .map(c => c.peerId)
            .filter(Boolean);

          // Send current state to new client
          ws.send(JSON.stringify({
            type: 'session-state',
            sessionId,
            host: session.host,
            isHost: session.host === peerId,
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

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});