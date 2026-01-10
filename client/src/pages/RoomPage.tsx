import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import VideoPlayer from '../VideoPlayer';
import Gallery from '../components/Gallery';
import { ClockSync } from '../ClockSync';
import { SyncEngine } from '../SyncEngine';
import { WebRTCManager } from '../WebRTCManager';

function generatePeerId() {
    return `peer-${Math.random().toString(36).substr(2, 9)}`;
}

export default function RoomPage() {
    const { sessionId } = useParams<{ sessionId: string }>();
    const navigate = useNavigate();

    const [connected, setConnected] = useState(false);
    const [isHost, setIsHost] = useState(false);
    const [syncEnabled, setSyncEnabled] = useState(true);
    const [hasInteracted, setHasInteracted] = useState(false);
    const [savedPosition, setSavedPosition] = useState<number | null>(null);
    const [showResumeUI, setShowResumeUI] = useState(false);
    const [peerId] = useState(generatePeerId());
    const [webrtcConnections, setWebrtcConnections] = useState<string[]>([]);

    const params = new URLSearchParams(window.location.search);
    const mediaIdFromUrl = params.get('mediaId');
    const initialPassword = params.get('password');
    const [currentMediaId, setCurrentMediaId] = useState<string | null>(mediaIdFromUrl);
    const [showGallery, setShowGallery] = useState(false);
    const [passwordRequired, setPasswordRequired] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const heartbeatIntervalRef = useRef<number | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const webrtcRef = useRef<WebRTCManager | null>(null);
    const clockSyncRef = useRef<ClockSync | null>(null);
    const syncEngineRef = useRef<SyncEngine | null>(null);

    const connect = useCallback((password: string | null) => {
        if (wsRef.current) {
            wsRef.current.close();
            if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current);
                heartbeatIntervalRef.current = null;
            }
        }

        const ws = new WebSocket('ws://localhost:3001');
        wsRef.current = ws;

        ws.onopen = () => {
            // console.log('Connected to signaling server');

            webrtcRef.current = new WebRTCManager(peerId, ws);
            clockSyncRef.current = new ClockSync();
            syncEngineRef.current = new SyncEngine(webrtcRef.current, clockSyncRef.current);

            syncEngineRef.current.setSessionId(sessionId!);
            const saved = syncEngineRef.current.getSavedPosition();
            if (saved) {
                setSavedPosition(saved);
                setShowResumeUI(true);
            }

            webrtcRef.current.onConnectionStateChange = () => {
                setWebrtcConnections(webrtcRef.current?.getConnectedPeers() || []);
            };

            ws.send(JSON.stringify({
                type: 'join',
                sessionId: sessionId,
                peerId,
                mediaId: mediaIdFromUrl,
                password: password || initialPassword
            }));

            heartbeatIntervalRef.current = window.setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'heartbeat' }));
                }
            }, 30000);
        };

        ws.onmessage = async (event) => {
            try {
                const message = JSON.parse(event.data);

                switch (message.type) {
                    case 'error':
                        if (message.code === 'password-required') {
                            setPasswordRequired(true);
                        } else {
                            alert(message.message);
                        }
                        break;
                    case 'session-state':
                        setConnected(true);
                        setIsHost(message.isHost);
                        setCurrentMediaId(message.mediaId);
                        syncEngineRef.current?.setIsHost(message.isHost);

                        if (!message.isHost && webrtcRef.current) {
                            clockSyncRef.current?.setWebRTC(webrtcRef.current, message.host);
                        }

                        if (webrtcRef.current) {
                            for (const existingPeer of message.peers) {
                                if (existingPeer !== peerId && peerId > existingPeer) {
                                    await webrtcRef.current.createOffer(existingPeer);
                                }
                            }
                        }
                        break;

                    case 'peer-joined':
                        if (webrtcRef.current && message.peerId !== peerId && peerId > message.peerId) {
                            await webrtcRef.current.createOffer(message.peerId);
                        }
                        break;

                    case 'media-changed':
                        setCurrentMediaId(message.mediaId);
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
                        syncEngineRef.current?.setIsHost(newIsHost);
                        if (!newIsHost && webrtcRef.current) {
                            clockSyncRef.current?.updateHost(message.newHost);
                            clockSyncRef.current?.setWebRTC(webrtcRef.current, message.newHost);
                        }
                        break;
                }
            } catch (err) {
                console.error('Error handling message:', err);
            }
        };

        ws.onclose = () => setConnected(false);
    }, [peerId, sessionId, mediaIdFromUrl, initialPassword]);

    useEffect(() => {
        if (!sessionId) {
            navigate('/');
            return;
        }
        connect(null);
        return () => {
            if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current);
                heartbeatIntervalRef.current = null;
            }
            clockSyncRef.current?.destroy();
            syncEngineRef.current?.destroy();
            webrtcRef.current?.destroy();
            wsRef.current?.close();
        };
    }, [sessionId, navigate, connect]);

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordRequired(false);
        connect(passwordInput);
    };

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
        const videoElement = document.querySelector('video');
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

    const handleMediaSelect = (mediaKey: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'change-media',
                mediaId: mediaKey
            }));
            setShowGallery(false);
        }
    };

    return (
        <div style={{ padding: '2rem', minHeight: '100vh', backgroundColor: '#0f172a', color: 'white' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                            FIDO <span style={{ color: '#64748b', fontWeight: 400 }}>/ ROOM</span>
                        </h1>
                        <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Session: {sessionId}</p>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{
                            padding: '8px 16px',
                            backgroundColor: connected ? '#10b981' : '#ef4444',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700
                        }}>
                            {connected ? 'CONNECTED' : 'OFFLINE'}
                        </div>

                        <div style={{
                            padding: '8px 16px',
                            backgroundColor: webrtcConnections.length > 0 ? '#3b82f6' : '#334155',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700
                        }}>
                            {webrtcConnections.length} PEERS
                        </div>

                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(window.location.href);
                                alert('Invite link copied!');
                            }}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#6366f1',
                                color: 'white',
                                border: 'none',
                                borderRadius: 8,
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer'
                            }}
                        >
                            INVITE
                        </button>

                        {isHost && (
                            <button
                                onClick={() => setShowGallery(!showGallery)}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#374151',
                                    color: 'white',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: 8,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                {showGallery ? 'CLOSE GALLERY' : 'CHANGE VIDEO'}
                            </button>
                        )}
                    </div>
                </div>

                {showGallery && isHost && (
                    <div style={{
                        marginBottom: '2rem',
                        padding: '2rem',
                        backgroundColor: 'rgba(30, 41, 59, 0.5)',
                        borderRadius: '16px',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                        <Gallery onSelect={(media) => handleMediaSelect(media.r2_key)} />
                    </div>
                )}

                {connected ? (
                    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', backgroundColor: 'black', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                        <VideoPlayer
                            syncEngine={syncEngineRef.current}
                            isHost={isHost}
                            mediaId={currentMediaId}
                            syncEnabled={syncEnabled}
                            onSyncToggle={handleSyncToggle}
                            savedPosition={showResumeUI ? savedPosition : null}
                            onResumePosition={handleResumePosition}
                            onDismissResume={handleDismissResume}
                        />

                        {!hasInteracted && (
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                backdropFilter: 'blur(8px)',
                                zIndex: 10
                            }}>
                                <button
                                    onClick={handleJoinClick}
                                    style={{
                                        padding: '1.25rem 3rem',
                                        fontSize: '1.25rem',
                                        fontWeight: 700,
                                        backgroundColor: '#3b82f6',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '16px',
                                        cursor: 'pointer',
                                        boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.5)'
                                    }}
                                >
                                    Join Session
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                        Establishing connection...
                    </div>
                )}

                {passwordRequired && (
                    <div style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        backdropFilter: 'blur(12px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 100
                    }}>
                        <form
                            onSubmit={handlePasswordSubmit}
                            style={{
                                width: '100%',
                                maxWidth: '400px',
                                padding: '2.5rem',
                                backgroundColor: '#1e293b',
                                borderRadius: '24px',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                                textAlign: 'center'
                            }}
                        >
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Protected Room</h2>
                            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '2rem' }}>Please enter the room password to join.</p>

                            <input
                                type="password"
                                placeholder="Room Password"
                                autoFocus
                                value={passwordInput}
                                onChange={(e) => setPasswordInput(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '1rem',
                                    backgroundColor: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '12px',
                                    color: 'white',
                                    marginBottom: '1.5rem',
                                    outline: 'none',
                                    fontSize: '1rem'
                                }}
                            />

                            <button
                                type="submit"
                                style={{
                                    width: '100%',
                                    padding: '1rem',
                                    backgroundColor: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontWeight: 700,
                                    fontSize: '1rem',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                                }}
                            >
                                Enter Room
                            </button>

                            <button
                                type="button"
                                onClick={() => navigate('/')}
                                style={{
                                    marginTop: '1.5rem',
                                    backgroundColor: 'transparent',
                                    color: '#64748b',
                                    border: 'none',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel and Go Back
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
