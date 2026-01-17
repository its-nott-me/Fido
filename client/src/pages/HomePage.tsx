import Hero from '../components/Hero';
import Features from '../components/Features';
import VisualEffects from '../components/VisualEffects';
import MockupHUD from '../components/MockupHUD';
import './HomePage.css';
import { Linkedin, Github } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub, faLinkedin } from '@fortawesome/free-brands-svg-icons';

export default function HomePage() {
    return (
        <div className="home-page landing-theme">
            <VisualEffects />

            <Hero />

            <main className="landing-main">
                <section className="stats-section">
                    <div className="stats-container">
                        <div className="stat-item">
                            <div className="stat-value">50ms</div>
                            <div className="stat-label">AVR LATENCY</div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-value">99%</div>
                            <div className="stat-label">SYNC ACCURACY</div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-value">HLS</div>
                            <div className="stat-label">FAST STREAMING</div>
                        </div>
                    </div>
                </section>

                <section className="preview-section">
                    <div className="preview-header">
                        <h2 className="section-title">Visual HUD Overview</h2>
                        <p className="section-subtitle">An interface for high-focus synchronization</p>
                    </div>
                    <MockupHUD />
                </section>

                <Features />

                <section className="cta-section">
                    <div className="glass-module cta-card">
                        <h2>Start a Synchronized Session</h2>
                        <p>
                            Create a room, upload media, and sync across devices.
                        </p>
                        <div className="cta-buttons">
                            <button
                                className="nav-btn-primary"
                                onClick={() => window.location.href = '/register'}
                            >
                                Register
                            </button>
                            <button
                                className="glass-module"
                                onClick={() => window.location.href = '/login'}
                            >
                                Sign in
                            </button>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="footer">
                <div className="footer-content">
                    <p>
                        © 2026 FIDO - A portfolio project by Vivek S M
                    </p>
                    <div className="footer-links">
                        <a href="https://github.com/its-nott-me" target="_blank" rel="noreferrer">
                            <FontAwesomeIcon icon={faGithub} size='2x' />
                        </a>
                        <span>·</span>
                        <a href="https://www.linkedin.com/in/vivek-sm-361589340/" target="_blank" rel="noreferrer">
                            <FontAwesomeIcon icon={faLinkedin} size='2x' />
                        </a>
                    </div>
                </div>
            </footer>

        </div>
    );
}
