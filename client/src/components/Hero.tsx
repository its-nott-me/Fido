import { useEffect, useRef } from 'react';
import './Hero.css';

export default function Hero() {
    const textRef = useRef(null);
    useEffect(() => {
        const text = "Watch Together..";
        const typeSpeed = 120;
        const deleteSpeed = 80;
        const pauseAfterType = 3600;

        let i = 0;
        let isDeleting = false;
        let timeoutId;

        const el = textRef.current;
        if (!el) return;

        const tick = () => {
            if (!isDeleting) {
                // Typing forward
                el.textContent = text.slice(0, i + 1);
                i++;

                if (i === text.length) {
                    timeoutId = setTimeout(() => {
                        isDeleting = true;
                        tick();
                    }, pauseAfterType);
                    return;
                }
            } else {
                // Deleting backward
                el.textContent = text.slice(0, i - 1);
                i--;

                if (i === 0) {
                    isDeleting = false;
                }
            }

            timeoutId = setTimeout(
                tick,
                isDeleting ? deleteSpeed : typeSpeed
            );
        };

        tick();

        return () => clearTimeout(timeoutId);
    }, []);

    return (
        <section className="hero-section">
            <div className="hero-glow-core"></div>
            <div className="hero-content">
                <div className="hero-badge typing-badge">
                    <span ref={textRef} className="typed-text">Watch Together</span>
                    <span className="cursor">▍</span>
                </div>
                <h1 className="hero-title">
                    Sync Your <span className="gradient-text">Reality</span>
                </h1>
                <p className="hero-subtitle">
                    The ultimate platform for synchronized video experiences.
                    Watch together, anytime, anywhere, in perfect harmony.
                </p>
                {/* <div className="hero-actions">
                    <button className="nav-btn-primary hero-btn">Launch Simulator</button>
                    <button className="glass-module hero-btn-secondary">Technical Specs</button>
                </div> */}
            </div>
        </section>
    );
}
