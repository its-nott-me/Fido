import './Features.css';
import {
  Clock,
  Radio,
  Cloud,
  Gamepad2,
} from "lucide-react";

const FEATURES = [
  {
    title: "Frame-Perfect Sync",
    desc: "All viewers stay locked to the same timestamp, even across networks and devices.",
    icon: Clock,
  },
  {
    title: "Adaptive HLS Streaming",
    desc: "Videos stream smoothly using segmented HLS playback, optimized for any connection.",
    icon: Radio,
  },
  {
    title: "Cloud-Native Media",
    desc: "Your videos are securely stored and streamed from global edge infrastructure.",
    icon: Cloud,
  },
  {
    title: "Zero-Lag Controls",
    desc: "Play, pause, and seek actions propagate instantly without breaking sync.",
    icon: Gamepad2,
  },
];


export default function Features() {
    return (
        <section className="features-section">
            <div className="features-header">
              <h2 className="features-title">Playback, Done Right</h2>
              <p className="features-subtitle">
                Precise timing, resilient streaming, and real-time coordination.
              </p>
            </div>
            <div className="features-grid">
                {FEATURES.map((f, i) => (
                    <div key={i} className="feature-card shine-effect glass-module">
                        <div className="feature-icon">
                            <f.icon size={28} strokeWidth={1.5} />
                        </div>
                        <h3>{f.title}</h3>
                        <p>{f.desc}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}
