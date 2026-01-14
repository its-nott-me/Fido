import Hero from '../components/Hero';
import Features from '../components/Features';
import VisualEffects from '../components/VisualEffects';
import MockupHUD from '../components/MockupHUD';
import './HomePage.css';

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
                            <div className="stat-value">99.9%</div>
                            <div className="stat-label">SYNC ACCURACY</div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-value">E2EE</div>
                            <div className="stat-label">SIGNAL SECURITY</div>
                        </div>
                    </div>
                </section>

                <section className="preview-section">
                    <div className="preview-header">
                        <h2 className="section-title">Visual HUD Overview</h2>
                        <p className="section-subtitle">A zero-gravity interface for high-focus synchronization</p>
                    </div>
                    <MockupHUD />
                </section>

                <Features />

                <section className="cta-section">
                    <div className="glass-module cta-card">
                        <h2>Ready to Sync?</h2>
                        <p>Join thousands of users experiencing perfectly synchronized media today.</p>
                        <div className="cta-buttons">
                            <button className="nav-btn-primary" onClick={() => window.location.href = '/register'}>Initialize Identity</button>
                            <button className="glass-module" onClick={() => window.location.href = '/login'}>Signal Dashboard</button>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="footer">
                <div className="footer-content">
                    <p>© 2026 FIDO. Redefining Shared Experiences.</p>
                </div>
            </footer>
        </div>
    );
}
