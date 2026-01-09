import { useEffect, useState, useRef } from 'react';
import VideoPlayer from './VideoPlayer';
import { ClockSync } from './ClockSync';
import { SyncEngine } from './SyncEngine';
import { WebRTCManager } from './WebRTCManager';

function generatePeerId() {
  return `peer-${Math.random().toString(36).substr(2, 9)}`;
}

export default function App() {
  const [connected, setConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false); 
  const [savedPosition, setSavedPosition] = useState<number | null>(null); 
  const [showResumeUI, setShowResumeUI] = useState(false);
  const [peerId] = useState(generatePeerId());
  const [sessionId, setSessionId] = useState(() => {
    // Get from URL or generate new
    const params = new URLSearchParams(window.location.search);
    return params.get('session') || `session-${Math.random().toString(36).substr(2, 9)}`;
  });
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
  const [webrtcConnections, setWebrtcConnections] = useState<string[]>([]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const webrtcRef = useRef<WebRTCManager | null>(null);
  const clockSyncRef = useRef<ClockSync | null>(null);
  const syncEngineRef = useRef<SyncEngine | null>(null);
  const [hostPeerId, setHostPeerId] = useState<string | null>(null);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to signaling server');
      
      // Initialize WebRTC Manager
      webrtcRef.current = new WebRTCManager(peerId, ws);
      
      // Initialize clock sync
      clockSyncRef.current = new ClockSync();
      
      // Initialize sync engine
      syncEngineRef.current = new SyncEngine(webrtcRef.current, clockSyncRef.current);

      syncEngineRef.current.setSessionId(sessionId);
      const saved = syncEngineRef.current.getSavedPosition();
      if (saved) {
        setSavedPosition(saved);
        setShowResumeUI(true);
      }

      // Monitor WebRTC connection changes
      webrtcRef.current.onConnectionStateChange = (peerIdChanged, state) => {
        console.log(`WebRTC to ${peerIdChanged}: ${state}`);
        setWebrtcConnections(webrtcRef.current?.getConnectedPeers() || []);
      };

      // Join session
      ws.send(JSON.stringify({
        type: 'join',
        sessionId: sessionId,
        peerId
      }));
    };

    ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'session-state':
            setConnected(true);
            setIsHost(message.isHost);
            setHostPeerId(message.host);
            setConnectedPeers(message.peers);
            
            syncEngineRef.current?.setIsHost(message.isHost);

            if (!message.isHost && webrtcRef.current) {
              // Non-host: set up clock sync with host
              clockSyncRef.current?.setWebRTC(webrtcRef.current, message.host);
            }

            // Initiate WebRTC connections to all existing peers
            if (webrtcRef.current) {
              for (const existingPeer of message.peers) {
                if (existingPeer !== peerId) {
                  // Only create offer if our peer ID is greater (to avoid duplicate connections)
                  if (peerId > existingPeer) {
                    await webrtcRef.current.createOffer(existingPeer);
                  }
                }
              }
            }
            
            console.log('Session state:', message);
            break;

          case 'peer-joined':
            setConnectedPeers(message.peers);
            
            // If new peer's ID is less than ours, we create the offer
            if (webrtcRef.current && message.peerId !== peerId && peerId > message.peerId) {
              await webrtcRef.current.createOffer(message.peerId);
            }
            
            console.log('Peer joined:', message.peerId);
            break;

          case 'peer-left':
            setConnectedPeers(message.peers);
            console.log('Peer left:', message.peerId);
            break;

          case 'webrtc-offer':
            if (webrtcRef.current) {
              await webrtcRef.current.handleOffer(message.fromPeerId, message.offer);
            }
            break;

          case 'webrtc-answer':
            if (webrtcRef.current) {
              await webrtcRef.current.handleAnswer(message.fromPeerId, message.answer);
            }
            break;

          case 'webrtc-ice-candidate':
            if (webrtcRef.current) {
              await webrtcRef.current.handleIceCandidate(message.fromPeerId, message.candidate);
            }
            break;

          case 'host-changed':
            const newIsHost = message.newHost === peerId;
            setIsHost(newIsHost);
            setHostPeerId(message.newHost);
            setConnectedPeers(message.peers);
            syncEngineRef.current?.setIsHost(newIsHost);
            
            if (!newIsHost && webrtcRef.current) {
              clockSyncRef.current?.updateHost(message.newHost);
              clockSyncRef.current?.setWebRTC(webrtcRef.current, message.newHost);
            }
            
            console.log('New host:', message.newHost);
            break;
        }
      } catch (err) {
        console.error('Error handling message:', err);
      }
    };

    ws.onclose = () => {
      console.log('Disconnected from signaling server');
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
      webrtcRef.current?.destroy();
      ws.close();
    };
  }, [peerId]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('session', sessionId);
    window.history.replaceState({}, '', url.toString());
  }, [sessionId]);

  const handleResumePosition = () => {
    const videoElement = document.querySelector('video') as HTMLVideoElement;
    if (videoElement && savedPosition) {
      videoElement.currentTime = savedPosition;
    }
    setShowResumeUI(false);
  };

  const handleDismissResume = () => {
    syncEngineRef.current?.clearSavedPosition();
    setShowResumeUI(false);
    setSavedPosition(null);
  };

  const handleJoinClick = async () => {
    // Interact with video to enable autoplay
    const videoElement = document.querySelector('video');
    console.log('novideo')
    if (videoElement) {
      try {
        await videoElement.play();
        videoElement.pause();
        setHasInteracted(true);
      } catch (err) {
        console.error('Failed to interact with video:', err);
      }
    }
  };

  const handleSyncToggle = (enabled: boolean) => {
    setSyncEnabled(enabled);
    syncEngineRef.current?.setSyncEnabled(enabled);
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '2rem', fontSize: '2rem', fontWeight: 'bold' }}>
        Perceptual Watch-Together MVP
      </h1>

      <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ 
          display: 'inline-block',
          padding: '8px 16px',
          backgroundColor: connected ? '#10b981' : '#ef4444',
          borderRadius: 6,
          fontSize: 14,
          fontWeight: 600
        }}>
          {connected ? '● Signaling Connected' : '○ Disconnected'}
        </div>

        <div style={{ 
          display: 'inline-block',
          padding: '8px 16px',
          backgroundColor: webrtcConnections.length > 0 ? '#3b82f6' : '#6b7280',
          borderRadius: 6,
          fontSize: 14,
          fontWeight: 600
        }}>
          WebRTC: {webrtcConnections.length} peer{webrtcConnections.length !== 1 ? 's' : ''}
        </div>
        
        <div style={{ 
          padding: '8px 16px',
          backgroundColor: 'rgba(17, 24, 39, 0.8)',
          borderRadius: 6,
          fontSize: 14,
          color: '#9ca3af'
        }}>
          Peer ID: {peerId.substring(0, 12)}...
        </div>

        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            alert('Session link copied! Share with others to watch together.');
          }}
          style={{
            padding: '8px 16px',
            backgroundColor: '#8b5cf6',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          📋 Share Session
        </button>
      </div>

      {connected ? (
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            backgroundColor: 'black'
          }}
        >
          <VideoPlayer
            syncEngine={syncEngineRef.current}
            isHost={isHost}
            syncEnabled={syncEnabled}
            onSyncToggle={handleSyncToggle}
            savedPosition={showResumeUI ? savedPosition : null}
            onResumePosition={handleResumePosition}
            onDismissResume={handleDismissResume}
          />

          {/* Overlay */}
          {!hasInteracted && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4rem',
                gap: '1.5rem',
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(6px)',
                zIndex: 10
              }}
            >
              <div
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  color: '#d1d5db'
                }}
              >
                Ready to join the session
              </div>

              <button
                onClick={handleJoinClick}
                style={{
                  padding: '16px 48px',
                  fontSize: '1.2rem',
                  fontWeight: 600,
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 12,
                  cursor: 'pointer',
                  boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.5)',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                🎬 Click to Join
              </button>

              {/* <div
                style={{
                  fontSize: '0.9rem',
                  color: '#9ca3af'
                }}
              >
                Browser requires interaction before video can autoplay
              </div> */}
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            padding: '3rem',
            textAlign: 'center',
            color: '#9ca3af'
          }}
        >
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
        <h2 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>What's New</h2>
        <ul style={{ paddingLeft: '1.5rem', color: '#d1d5db' }}>
          <li><strong>WebRTC P2P:</strong> Sync happens directly between browsers (low latency)</li>
          <li><strong>Buffer Monitoring:</strong> Green bar shows buffer health, prevents play when buffer is low</li>
          <li><strong>Smart Buffering:</strong> Host checks buffer before playing, shows "Buffering..." overlay</li>
          <li><strong>WebSocket for Signaling Only:</strong> Server only helps establish P2P connections</li>
        </ul>
        
        <h2 style={{ marginTop: '1.5rem', marginBottom: '1rem', fontSize: '1.2rem' }}>Instructions</h2>
        <ol style={{ paddingLeft: '1.5rem', color: '#d1d5db' }}>
          <li>Open multiple browser windows</li>
          <li>Wait for WebRTC connections to establish (blue badge shows count)</li>
          <li>HOST controls playback, others sync via P2P</li>
          <li>Watch buffer health bar at top of video (green = good)</li>
          <li>Try seeking ahead - system waits for buffer before playing</li>
        </ol>
      </div>
    </div>
  );
}