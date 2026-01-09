import { useEffect, useState, useRef } from 'react';
import VideoPlayer from './VideoPlayer';
import { ClockSync } from './ClockSync';
import { SyncEngine } from './SyncEngine';

function generatePeerId() {
  return `peer-${Math.random().toString(36).substr(2, 9)}`;
}

export default function App() {
  const [connected, setConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [peerId] = useState(generatePeerId());
  
  const wsRef = useRef<WebSocket | null>(null);
  const clockSyncRef = useRef<ClockSync | null>(null);
  const syncEngineRef = useRef<SyncEngine | null>(null);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to server');
      
      // Initialize clock sync
      clockSyncRef.current = new ClockSync(ws);
      
      // Initialize sync engine
      syncEngineRef.current = new SyncEngine(ws, clockSyncRef.current);

      // Join session
      ws.send(JSON.stringify({
        type: 'join',
        sessionId: 'default-session',
        peerId
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'session-state':
            setConnected(true);
            setIsHost(message.isHost);
            syncEngineRef.current?.setIsHost(message.isHost);
            console.log('Session state:', message);
            break;

          case 'clock-pong':
            clockSyncRef.current?.handlePong(
              message.clientSendTime,
              message.serverReceiveTime,
              message.serverSendTime
            );
            break;

          case 'sync-snapshot':
            syncEngineRef.current?.handleSyncSnapshot({
              position: message.position,
              playing: message.playing,
              timestamp: message.timestamp,
              version: message.version
            });
            break;

          case 'command':
            syncEngineRef.current?.handleCommand(message.state, message.version);
            break;

          case 'host-changed':
            const newIsHost = message.newHost === peerId;
            setIsHost(newIsHost);
            syncEngineRef.current?.setIsHost(newIsHost);
            console.log('New host:', message.newHost);
            break;

          case 'peer-joined':
            console.log('Peer joined:', message.peerId);
            break;

          case 'peer-left':
            console.log('Peer left:', message.peerId);
            break;
        }
      } catch (err) {
        console.error('Error handling message:', err);
      }
    };

    ws.onclose = () => {
      console.log('Disconnected from server');
      setConnected(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    // Heartbeat
    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, 30000);

    return () => {
      clearInterval(heartbeatInterval);
      clockSyncRef.current?.destroy();
      syncEngineRef.current?.destroy();
      ws.close();
    };
  }, [peerId]);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '2rem', fontSize: '2rem', fontWeight: 'bold' }}>
        Perceptual Watch-Together MVP
      </h1>

      <div style={{ marginBottom: '2rem' }}>
        <div style={{ 
          display: 'inline-block',
          padding: '8px 16px',
          backgroundColor: connected ? '#10b981' : '#ef4444',
          borderRadius: 6,
          fontSize: 14,
          fontWeight: 600
        }}>
          {connected ? '● Connected' : '○ Disconnected'}
        </div>
        
        <div style={{ marginTop: 8, color: '#9ca3af', fontSize: 14 }}>
          Peer ID: {peerId}
        </div>
      </div>

      {connected ? (
        <VideoPlayer 
          syncEngine={syncEngineRef.current} 
          isHost={isHost}
        />
      ) : (
        <div style={{ 
          padding: '3rem',
          textAlign: 'center',
          color: '#9ca3af'
        }}>
          Connecting to server...
        </div>
      )}

      <div style={{ 
        marginTop: '3rem',
        padding: '1.5rem',
        backgroundColor: 'rgba(17, 24, 39, 0.8)',
        borderRadius: 8,
        fontSize: 14,
        lineHeight: 1.6
      }}>
        <h2 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>Instructions</h2>
        <ol style={{ paddingLeft: '1.5rem', color: '#d1d5db' }}>
          <li>Open this page in multiple browser windows</li>
          <li>The first client becomes the HOST (blue badge)</li>
          <li>Play/pause/seek on the HOST window</li>
          <li>Other windows will automatically sync</li>
          <li>Watch the sync quality dots (top right) - green = good sync</li>
          <li>If drift exceeds 2s, you'll see a "Sync Now" button</li>
        </ol>
      </div>
    </div>
  );
}