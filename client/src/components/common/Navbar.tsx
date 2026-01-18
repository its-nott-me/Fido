import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
    const { user, logout } = useAuth();

    return (
        <nav className='navbar glass-module'>
            <div className='nav-container'>
                <Link to='/' className='nav-logo'>
                    FIDO<span className='dot'>.</span>
                </Link>

                <div className='nav-links'>
                    {user ? (
                        <>
                            <Link to='/dashboard' className='nav-link'>Dashboard</Link>
                            <span className='user-welcome'>Hello, <b>{user.username}</b></span>
                            <button onClick={logout} className='nav-btn-primary'>Logout</button>
                        </>
                    ) : (
                        <>
                            <Link to='/login' className='nav-link'>Login</Link>
                            <Link to='/register' className='nav-btn-primary register'>Get Started</Link>
                        </>
                    )}
                </div>
            </div>
        </nav>
    )
}