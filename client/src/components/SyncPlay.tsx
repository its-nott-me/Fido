import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SyncPlay.css';

export default function SyncPlay() {
    const navigate = useNavigate();
    const [sessionId, setSessionId] = useState('');
    const [password, setPassword] = useState('');

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
        <div className="sync-play-container glass-module">
            <h2 className="section-title">Rooms</h2>

            <div className="input-group">
                <label className="input-label">Join Existing Room</label>
                <div className="join-controls">
                    <input
                        type="text"
                        placeholder="Enter Room ID"
                        value={sessionId}
                        onChange={(e) => setSessionId(e.target.value)}
                        className="glass-input"
                    />
                    <button
                        onClick={() => handleJoinRoom()}
                        disabled={!sessionId}
                        className="btn-join"
                    >
                        Join
                    </button>
                </div>
            </div>

            <div className="divider">
                <span>OR</span>
            </div>

            <div className="create-session-box">
                <h3 className="sub-title">Start New Session</h3>
                <input
                    type="password"
                    placeholder="Optional Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="glass-input"
                />
                <button
                    onClick={handleCreateRoom}
                    className="nav-btn-primary btn-create"
                >
                    Create Private Room
                </button>
            </div>
        </div>
    );
}
