import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from '../axios/axios';
import { useAuth } from '../context/AuthContext';

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
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Login failed. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            background: 'radial-gradient(circle at bottom left, #1e1b4b, #0f172a)',
            color: 'white'
        }}>
            <div style={{
                maxWidth: '400px',
                width: '100%',
                padding: '2.5rem',
                backgroundColor: 'rgba(30, 41, 59, 0.4)',
                backdropFilter: 'blur(16px)',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>Welcome Back</h1>
                    <p style={{ color: '#94a3b8' }}>Login to your FIDO account</p>
                </div>

                {error && (
                    <div style={{
                        padding: '1rem',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '12px',
                        color: '#f87171',
                        fontSize: '0.875rem',
                        marginBottom: '1.5rem',
                        textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#94a3b8' }}>Username</label>
                        <input
                            type="text"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            style={{
                                padding: '0.875rem 1rem',
                                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '12px',
                                color: 'white',
                                outline: 'none',
                                fontSize: '1rem',
                                transition: 'border-color 0.2s'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#94a3b8' }}>Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{
                                padding: '0.875rem 1rem',
                                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '12px',
                                color: 'white',
                                outline: 'none',
                                fontSize: '1rem'
                            }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        style={{
                            marginTop: '1rem',
                            padding: '1rem',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontWeight: 600,
                            fontSize: '1rem',
                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                            opacity: isSubmitting ? 0.7 : 1
                        }}
                    >
                        {isSubmitting ? 'Logging in...' : 'Login'}
                    </button>
                </form>

                <p style={{ marginTop: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
                    Don't have an account? <Link to="/register" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>Sign up</Link>
                </p>
            </div>
        </div>
    );
}
