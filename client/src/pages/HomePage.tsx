import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Upload from '../components/Upload';
import Gallery from '../components/Gallery';

export default function HomePage() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [sessionId, setSessionId] = useState('');
    const [password, setPassword] = useState('');
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const handleUploadSuccess = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    const handleCreateRoom = () => {
        const id = Math.random().toString(36).substr(2, 9);
        const passPart = password ? `?password=${encodeURIComponent(password)}` : '';
        navigate(`/room/${id}${passPart}`);
    };

    const handleJoinRoom = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (sessionId.trim()) {
            navigate(`/room/${sessionId.trim()}`);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '2rem',
            background: 'radial-gradient(circle at top right, #1e293b, #0f172a)',
            color: 'white'
        }}>
            {/* Header / Nav */}
            <div style={{
                width: '100%',
                maxWidth: '1000px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4rem'
            }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.025em' }}>FIDO</h1>

                {user ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                            Welcome, <span style={{ color: 'white', fontWeight: 600 }}>{user.username}</span>
                        </span>
                        <button
                            onClick={logout}
                            style={{
                                padding: '0.5rem 1.25rem',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                color: '#f87171',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                borderRadius: '8px',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            Logout
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button
                            onClick={() => navigate('/login')}
                            style={{
                                padding: '0.5rem 1.25rem',
                                color: 'white',
                                background: 'transparent',
                                border: 'none',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            Login
                        </button>
                        <button
                            onClick={() => navigate('/register')}
                            style={{
                                padding: '0.5rem 1.25rem',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            Sign Up
                        </button>
                    </div>
                )}
            </div>

            <div style={{
                maxWidth: '1000px',
                width: '100%',
                display: 'grid',
                gridTemplateColumns: user ? '350px 1fr' : '1fr',
                gap: '3rem'
            }}>
                {/* Sync Play Section */}
                <div style={{
                    padding: '2.5rem',
                    backgroundColor: 'rgba(30, 41, 59, 0.5)',
                    backdropFilter: 'blur(12px)',
                    borderRadius: '24px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2rem'
                }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Sync Play</h2>

                    <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '0.75rem' }}>
                            Join Existing Room
                        </label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                type="text"
                                placeholder="Room ID"
                                value={sessionId}
                                onChange={(e) => setSessionId(e.target.value)}
                                style={{
                                    flex: 1,
                                    padding: '0.75rem 1rem',
                                    backgroundColor: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '12px',
                                    color: 'white',
                                    outline: 'none'
                                }}
                            />
                            <button
                                onClick={() => handleJoinRoom()}
                                disabled={!sessionId}
                                style={{
                                    padding: '0.75rem 1.25rem',
                                    backgroundColor: sessionId ? '#3b82f6' : '#1e293b',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontWeight: 600,
                                    cursor: sessionId ? 'pointer' : 'default',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Join
                            </button>
                        </div>
                    </div>

                    <div style={{
                        padding: '1.5rem',
                        backgroundColor: 'rgba(99, 102, 241, 0.05)',
                        borderRadius: '20px',
                        border: '1px solid rgba(99, 102, 241, 0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                    }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#a5b4fc' }}>Start New Session</h3>
                        <input
                            type="password"
                            placeholder="Optional Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{
                                padding: '0.75rem 1rem',
                                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '12px',
                                color: 'white',
                                fontSize: '0.875rem',
                                outline: 'none'
                            }}
                        />
                        <button
                            onClick={handleCreateRoom}
                            style={{
                                padding: '0.875rem',
                                backgroundColor: '#6366f1',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                                transition: 'transform 0.2s'
                            }}
                        >
                            Create Room
                        </button>
                    </div>
                </div>

                {/* User Content Section */}
                {user ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <Upload onUploadSuccess={handleUploadSuccess} />
                        <div style={{
                            flex: 1,
                            padding: '2rem',
                            backgroundColor: 'rgba(30, 41, 59, 0.5)',
                            borderRadius: '24px',
                            border: '1px solid rgba(255, 255, 255, 0.1)'
                        }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.5rem' }}>Your Collection</h3>
                            <Gallery refreshTrigger={refreshTrigger} />
                        </div>
                    </div>
                ) : (
                    <div style={{
                        padding: '3rem',
                        backgroundColor: 'rgba(15, 23, 42, 0.3)',
                        borderRadius: '24px',
                        border: '1px dashed rgba(255, 255, 255, 0.1)',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '1.5rem',
                            color: '#3b82f6'
                        }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21 15 16 10 5 21" />
                            </svg>
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white', marginBottom: '1rem' }}>
                            Your Personal Gallery
                        </h3>
                        <p style={{ fontSize: '0.925rem', color: '#94a3b8', lineHeight: 1.6, marginBottom: '2.5rem', maxWidth: '300px' }}>
                            Sign in to upload your own videos, manage your collection, and host sync'd parties with your content.
                        </p>
                        <button
                            onClick={() => navigate('/register')}
                            style={{
                                padding: '0.75rem 2.5rem',
                                backgroundColor: 'transparent',
                                color: '#3b82f6',
                                border: '1px solid #3b82f6',
                                borderRadius: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            Join Fido
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
