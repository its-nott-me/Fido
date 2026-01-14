import './Features.css';

const FEATURES = [
    {
        title: "Instant Sync",
        desc: "NTP-style clock synchronization ensures everyone sees the same frame at the same time.",
        icon: "⚡"
    },
    {
        title: "Glass HUD",
        desc: "A beautiful, futuristic interface that stays out of your way while you watch.",
        icon: "💎"
    },
    {
        title: "Cloud Gallery",
        desc: "Upload your media once and access it from any room instantly.",
        icon: "☁️"
    }
];

export default function Features() {
    return (
        <section className="features-section">
            <div className="features-header">
                <h2 className="features-title">Cutting-Edge Features</h2>
                <p className="features-subtitle">Experience the future of shared entertainment</p>
            </div>
            <div className="features-grid">
                {FEATURES.map((f, i) => (
                    <div key={i} className="feature-card glass-module">
                        <div className="feature-icon">{f.icon}</div>
                        <h3>{f.title}</h3>
                        <p>{f.desc}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}
