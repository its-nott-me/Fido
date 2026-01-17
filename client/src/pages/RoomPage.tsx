import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import VideoPlayer from '../VideoPlayer';
import Gallery from '../components/Gallery';
import { ClockSync } from '../ClockSync';
import { SyncEngine } from '../SyncEngine';
import { WebRTCManager } from '../WebRTCManager';
import './RoomPage.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserGear, faCommentDots, faCopy } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../context/AuthContext';
import Chat from '../components/Chat';
import ProfileSettings from '../components/ProfileSettings';

function generatePeerId() {
    return `peer-${Math.random().toString(36).substr(2, 9)}`;
}

export default function RoomPage() {
    const { sessionId } = useParams<{ sessionId: string }>();
    const navigate = useNavigate();

    const { user } = useAuth();
    const [connected, setConnected] = useState(false);
    const [isHost, setIsHost] = useState(false);
    const [syncEnabled, setSyncEnabled] = useState(true);
    const [hasInteracted, setHasInteracted] = useState(false);
    const [savedPosition, setSavedPosition] = useState<number | null>(null);
    // const [showResumeUI, setShowResumeUI] = useState(false);
    const [peerId] = useState(generatePeerId());
    const [webrtcConnections, setWebrtcConnections] = useState<string[]>([]);

    const params = new URLSearchParams(window.location.search);
    const mediaIdFromUrl = params.get('mediaId');
    const initialPassword = params.get('password');
    const [currentMediaId, setCurrentMediaId] = useState<string | null>(mediaIdFromUrl);
    const [showGallery, setShowGallery] = useState(false);
    const [passwordRequired, setPasswordRequired] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [messages, setMessages] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showChat, setShowChat] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [copied, setCopied] = useState(false);
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
            webrtcRef.current = new WebRTCManager(peerId, ws);
            clockSyncRef.current = new ClockSync();
            syncEngineRef.current = new SyncEngine(webrtcRef.current, clockSyncRef.current);

            syncEngineRef.current.setSessionId(sessionId!);
            // const saved = syncEngineRef.current.getSavedPosition();
            // if (saved) {
            //     setSavedPosition(saved);
            //     // setShowResumeUI(true);
            // }

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
                    case 'chat-message':
                        setMessages(prev => [...prev, message]);
                        if (!showChat && message.username !== user?.username) {
                            setUnreadCount(prev => prev + 1);
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

    // const handleResumePosition = () => {
    //     const videoElement = document.querySelector('video') as HTMLVideoElement;
    //     if (videoElement && savedPosition) {
    //         videoElement.currentTime = savedPosition;
    //     }
    //     setShowResumeUI(false);
    // };

    // const handleDismissResume = () => {
    //     syncEngineRef.current?.clearSavedPosition();
    //     setShowResumeUI(false);
    //     setSavedPosition(null);
    // };

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

    const handleSendMessage = (text: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'chat-message',
                username: user?.username,
                profileImageUrl: user?.profileImageUrl,
                text
            }));
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(sessionId!);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }

    if (!user) {
        return (
            <div className="dashboard-auth-notice">
                <div className="glass-module notice-card">
                    <h2>Access Denied</h2>
                    <p>Please login to access the room.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="room-page">
            <header className="room-header glass-module">
                <div className="room-info">
                    <h1>ID: {sessionId} {" "}
                        <FontAwesomeIcon
                            onClick={handleCopy}
                            icon={faCopy}
                            className='share-icon'
                        />
                        {copied &&
                            <span className='copied'>copied</span>
                        }
                    </h1>
                    <span className="session-tag">FIDO <span className="dot">/</span> STREAMING</span>
                </div>

                <div className="status-bar">
                    <div className={`status-indicator ${connected ? 'status-connected' : 'status-offline'}`}>
                        {connected ? 'Sync Online' : 'Signal Lost'}
                    </div>

                    <div className="room-actions">
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(window.location.href);
                            }}
                            className="nav-btn-primary action-btn"
                        >
                            Invite
                        </button>

                        {isHost && (
                            <button
                                onClick={() => setShowGallery(!showGallery)}
                                className="nav-btn-primary action-btn"
                            >
                                {showGallery ? 'Close Archive' : 'Select Media'}
                            </button>
                        )}
                        <button
                            onClick={() => setShowProfile(true)}
                            className="nav-btn-primary action-btn"
                        >
                            <FontAwesomeIcon icon={faUserGear} />
                        </button>
                    </div>
                </div>
            </header>

            {showProfile && <ProfileSettings onClose={() => setShowProfile(false)} />}

            <button
                className={`chat-toggle-btn ${showChat ? 'active' : ''}`}
                onClick={() => {
                    setShowChat(!showChat);
                    if (!showChat) setUnreadCount(0);
                }}
            >
                <FontAwesomeIcon icon={faCommentDots} />
                {unreadCount > 0 && !showChat && <span className="chat-badge">{unreadCount}</span>}
            </button>

            {showChat && (
                <Chat
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    onClose={() => setShowChat(false)}
                />
            )}

            <main className="player-container glass-module">
                <div className="mockup-header">
                    <div className="mockup-controls">
                        <span className="dot red"></span>
                        <span className="dot yellow"></span>
                        <span className="dot green"></span>
                    </div>
                    <div className="mockup-title">FIDO // FEED_{sessionId?.toUpperCase()}</div>
                    <div className="mockup-stats">
                        <span className="pulse"></span> {webrtcConnections.length + 1} PEERS ACTIVE
                    </div>
                </div>

                <div className="mockup-content">
                    <div className="scanline"></div>

                    {connected ? (
                        <div className="video-viewport">
                            <VideoPlayer
                                syncEngine={syncEngineRef.current}
                                isHost={isHost}
                                mediaId={currentMediaId}
                                syncEnabled={syncEnabled}
                                onSyncToggle={handleSyncToggle}
                            // savedPosition={showResumeUI ? savedPosition : null}
                            // onResumePosition={handleResumePosition}
                            // onDismissResume={handleDismissResume}
                            />
                        </div>
                    ) : (
                        <div className="interaction-overlay">
                            <div className="status-indicator">Initializing Uplink...</div>
                        </div>
                    )}

                    <div className="mockup-hud-elements">
                        <div className="hud-line top-left"></div>
                        <div className="hud-line top-right"></div>
                        <div className="hud-line bottom-left"></div>
                        <div className="hud-line bottom-right"></div>

                        <div className="hud-data-box hud-box-move">
                            <div className="data-row"><span>SYNC</span> [{syncEnabled ? 'ENABLED' : 'OFFLINE'}]</div>
                            <div className="data-row"><span>PEER</span> [{peerId.split('-')[1].toUpperCase()}]</div>
                            <div className="data-row"><span>HOST</span> [{isHost ? 'SELF' : 'REMOTE'}]</div>
                        </div>
                    </div>

                    {!hasInteracted && connected && (
                        <div className="interaction-overlay">
                            <button
                                onClick={handleJoinClick}
                                className="nav-btn-primary btn-join-session"
                            >
                                WATCH NOW!
                            </button>
                        </div>
                    )}

                </div>
            </main>

            {showGallery && isHost && (
                <div className="gallery-overlay glass-module">
                    <Gallery
                        onSelect={(media) => handleMediaSelect(media.r2_key)}
                        onClose={() => setShowGallery(false)}
                    />
                </div>
            )}

            {passwordRequired && (
                <div className="password-overlay">
                    <div className="password-card glass-module">
                        <h2>Password Required</h2>
                        {/* <p>Credentials required to access this signal</p> */}

                        <form onSubmit={handlePasswordSubmit}>
                            <input
                                type="password"
                                placeholder="Enter Password"
                                autoFocus
                                value={passwordInput}
                                onChange={(e) => setPasswordInput(e.target.value)}
                                className="auth-input"
                            />

                            <button
                                type="submit"
                                className="nav-btn-primary btn-password-submit action-btn"
                            >
                                SUBMIT
                            </button>

                            <button
                                type="button"
                                onClick={() => navigate('/')}
                                className="btn-cancel-room"
                            >
                                CANCEL
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
