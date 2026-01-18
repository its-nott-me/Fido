import { useEffect, useRef, useState } from 'react';
import VideoPlayer from '../VideoPlayer';
import axios from '../axios/axios.ts';
import './MockupHUD.css';

export default function MockupHUD() {
    const [progress, setProgress] = useState(0);
    const [clientCount, setClientCount] = useState<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchCount = async () => {
            try {
                const res = await axios.get('/api/stats/connected-clients');
                setClientCount(res.data.count);
            } catch (err) {
                console.error('Failed to fetch client count:', err);
            }
        };

        fetchCount();
        const interval = setInterval(fetchCount, 1000); // Update every 10 seconds
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const video = container.querySelector<HTMLVideoElement>("video");
        if (!video) return;

        const updateProgress = () => {
            if (!video.duration) return;
            setProgress(video.currentTime / video.duration);
        }

        video.addEventListener("timeupdate", updateProgress);

        return () => {
            video.removeEventListener('timeupdate', updateProgress);
        }
    }, []);

    return (
        <div className="mockup-container glass-module">
            <div className="mockup-header">
                <div className="mockup-controls">
                    <span className="dot red"></span>
                    <span className="dot yellow"></span>
                    <span className="dot green"></span>
                </div>
                <div className="mockup-title">FIDO // FEED_01</div>
                <div className="mockup-stats">
                    <span className="pulse"></span>
                    {
                        clientCount !== null ? (
                            clientCount == 0 ?
                                '4 PEERS ACTIVE' :
                                `${clientCount} PEERS ACTIVE`)
                            : 'LOADING...'
                    }
                </div>
            </div>

            <div className="mockup-content">
                <div ref={containerRef} className="mockup-video-placeholder">
                    <VideoPlayer
                        isHost={false}
                        mediaId={null}
                        onSyncToggle={() => console.log()}
                        syncEnabled={false}
                        syncEngine={null}
                        isMockView={true}
                    />
                    <div className="scanline"></div>
                    <div className="play-icon">▶</div>
                </div>

                <div className="mockup-hud-elements">
                    <div className="hud-line top-left"></div>
                    <div className="hud-line top-right"></div>
                    <div className="hud-line bottom-left"></div>
                    <div className="hud-line bottom-right"></div>

                    <div className="hud-data-box hud-box-move">
                        <div className="data-row"><span>SYNC</span> [100%]</div>
                        <div className="data-row"><span>PING</span> [34MS]</div>
                        <div className="data-row"><span>CORE</span> [STABLE]</div>
                    </div>
                </div>
            </div>

            {/* <div className="mockup-footer">
                <div className="timeline-mock">
                    <div className="progress-mock"></div>
                </div>
            </div> */}
            <div className="mockup-footer">
                <div
                    className="timeline-mock"
                    onClick={(e) => {
                        const container = containerRef.current;
                        const video = container?.querySelector<HTMLVideoElement>("video");
                        if (!video) return;

                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const newTime = (clickX / rect.width) * video.duration;
                        video.currentTime = newTime;
                    }}
                >
                    <div
                        className="progress-mock"
                        style={{ width: `${progress * 100}%` }}
                    ></div>
                </div>
            </div>
        </div>
    );
}
