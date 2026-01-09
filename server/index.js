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

          // Send current state to new client
          ws.send(JSON.stringify({
            type: 'session-state',
            sessionId,
            host: session.host,
            isHost: session.host === peerId,
            version: session.version,
            state: session.state,
            peers: Array.from(session.clients).map(c => c.peerId).filter(Boolean)
          }));

          // Notify others
          broadcast(sessionId, {
            type: 'peer-joined',
            peerId,
            peers: Array.from(session.clients).map(c => c.peerId).filter(Boolean)
          }, ws);

          break;
        }

        case 'command': {
          if (!currentSession) break;
          
          const session = sessions.get(currentSession);
          session.version = message.version;
          session.state = message.state;

          // Broadcast to all other clients
          broadcast(currentSession, {
            type: 'command',
            version: message.version,
            state: message.state,
            peerId: message.peerId
          }, ws);
          break;
        }

        case 'sync-snapshot': {
          if (!currentSession) break;

          // Host broadcasts sync snapshot
          broadcast(currentSession, {
            type: 'sync-snapshot',
            position: message.position,
            playing: message.playing,
            timestamp: message.timestamp,
            version: message.version
          }, ws);
          break;
        }

        case 'clock-ping': {
          // Immediately respond with pong
          ws.send(JSON.stringify({
            type: 'clock-pong',
            clientSendTime: message.timestamp,
            serverReceiveTime: Date.now(),
            serverSendTime: Date.now()
          }));
          break;
        }

        case 'heartbeat': {
          // Just acknowledge
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

        // If host left, elect new host
        if (session.host === peerId && session.clients.size > 0) {
          const newHost = Array.from(session.clients)[0].peerId;
          session.host = newHost;

          broadcast(currentSession, {
            type: 'host-changed',
            newHost
          });
        }

        // Clean up empty sessions
        if (session.clients.size === 0) {
          sessions.delete(currentSession);
        } else {
          broadcast(currentSession, {
            type: 'peer-left',
            peerId
          });
        }
      }
    }
  });

  // Store peerId on connection for later reference
  ws.peerId = null;
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});