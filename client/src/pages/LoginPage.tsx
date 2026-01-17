import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from '../axios/axios';
import { useAuth } from '../context/AuthContext';
import './AuthStyles.css';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            const response = await axios.post('/api/auth/login', { username, password });
            login(response.data.user, response.data.token);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Login failed. Please try again.');
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
                    <h1>Welcome Back</h1>
                </div>

                {error && <div className="auth-error">{error}</div>}

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="input-group">
                        <label>Username</label>
                        <input
                            type="text"
                            required
                            placeholder="username"
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

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="nav-btn-primary auth-button"
                    >
                        {isSubmitting ? 'Verifying...' : 'Login Server'}
                    </button>
                </form>

                <div className="auth-footer">
                    Don't have an account? <Link to="/register">Register Now!</Link>
                </div>
            </div>
        </div>
    );
}
