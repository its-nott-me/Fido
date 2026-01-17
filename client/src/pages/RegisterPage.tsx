import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from '../axios/axios';
import './AuthStyles.css';

export default function RegisterPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setIsSubmitting(true);

        try {
            await axios.post('/api/auth/register', { username, password });
            navigate('/login');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Registration failed. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-glow glow-1"></div>
            <div className="auth-glow glow-2"></div>

            <div className="auth-card glass-module">
                <div className="auth-header">
                    <h1>Create Identity</h1>
                    <p>Join the Fido network</p>
                </div>

                {error && <div className="auth-error">{error}</div>}

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="input-group">
                        <label>Username</label>
                        <input
                            type="text"
                            required
                            placeholder="choose_a_name"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="auth-input"
                        />
                    </div>

                    <div className="input-group">
                        <label>Password</label>
                        <input
                            type="password"
                            required
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="auth-input"
                        />
                    </div>

                    <div className="input-group">
                        <label>Confirm Password</label>
                        <input
                            type="password"
                            required
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="auth-input"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="nav-btn-primary auth-button"
                    >
                        {isSubmitting ? 'Processing...' : 'Register'}
                    </button>
                </form>

                <div className="auth-footer">
                    Already registered? <Link to="/login">Sign In</Link>
                </div>
            </div>
        </div>
    );
}
