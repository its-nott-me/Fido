import { useEffect, useRef, useState } from 'react';
import { SyncEngine } from './SyncEngine';
import api from './axios/axios';
import { useAuth } from './context/AuthContext';
import Hls from 'hls.js';

interface VideoPlayerProps {
  syncEngine: SyncEngine | null;
  isHost: boolean;
  mediaId: string | null;
  syncEnabled: boolean;
  onSyncToggle: (enabled: boolean) => void;
  isMockView: boolean;
  // savedPosition: number | null;
  // onResumePosition: () => void;
  // onDismissResume: () => void;
}

type DriftStrategy = 'locked' | 'soft-convergence' | 'show-ui' | 'force-resync';

export default function VideoPlayer({
  syncEngine,
  isHost,
  mediaId: initialMediaId,
  syncEnabled,
  onSyncToggle,
  isMockView = false,
  // savedPosition,
  // onResumePosition,
  // onDismissResume
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [drift, setDrift] = useState(0);
  const [_strategy, setStrategy] = useState<DriftStrategy>('locked');
  const [showResyncUI, setShowResyncUI] = useState(false);
  const [_buffering, setBuffering] = useState(false);
  const [bufferHealth, setBufferHealth] = useState(1);
  const [mediaUrl, setMediaUrl] = useState('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8');
  const { token } = useAuth();

  useEffect(() => {
    if (initialMediaId) {
      // console.log('VideoPlayer: initialMediaId changed to:', initialMediaId);
      getMediaUrl(initialMediaId);
    } else {
      // console.log('VideoPlayer: initialMediaId is null');
      // setMediaUrl('');
    }
  }, [initialMediaId]);

  useEffect(() => {
    const video = videoRef.current;
    if (video && syncEngine) {
      // console.log('VideoPlayer: Binding SyncEngine to video element');
      syncEngine.setVideoElement(video);

      syncEngine.onDriftChange = (newDrift, newStrategy) => {
        setDrift(newDrift);
        setStrategy(newStrategy);
        setShowResyncUI(newStrategy === 'show-ui' || newStrategy === 'force-resync');
      };

      syncEngine.onBufferStatus = (isBuffering, health) => {
        setBuffering(isBuffering);
        setBufferHealth(health);
      };

      return () => {
        // Optional: Add cleanup if SyncEngine support it
      };
    }
  }, [syncEngine, mediaUrl]);

  useEffect(() => {
    const video = videoRef.current;
    let hls: Hls | null = null;

    if (!mediaUrl || !video) return;

    (async () => {
      const type = await detectStreamType(mediaUrl);

      if (type == 'hls' && Hls.isSupported()) {
        hls = new Hls({ lowLatencyMode: false });

        hls.loadSource(mediaUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            console.error("HLS fatal error:", data);
            hls?.destroy();
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = mediaUrl;
      }
    })();
  }, [mediaUrl]);

  async function detectStreamType(mediaUrl: string): Promise<"hls" | "mp4" | "unknown"> {
    if (mediaUrl.includes('.m3u8')) return "hls";

    try {
      const head = await fetch(mediaUrl, { method: "HEAD" });
      const type = head.headers.get("content-type") || "";
      if (type.includes("mpegurl")) return "hls";
    } catch { }

    try {
      const res = await fetch(mediaUrl, {
        headers: { Range: "bytes=0-200" },
      });
      const text = await res.text();
      if (text.startsWith("EXTM3U")) return "hls";
    } catch { }

    if (mediaUrl.includes(".mp4")) return "mp4";

    return "unknown";
  }

  const handleResync = () => {
    syncEngine?.forceResync();
    setShowResyncUI(false);
  };

  const getSyncDots = () => {
    const absDrift = Math.abs(drift);
    let filledDots = 5;
    if (absDrift > 5) filledDots = 1;
    else if (absDrift > 2) filledDots = 2;
    else if (absDrift > 1) filledDots = 3;
    else if (absDrift > 0.4) filledDots = 4;

    return Array(5).fill(0).map((_, i) => (
      <div
        key={i}
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: i < filledDots ? '#4ade80' : '#374151',
          transition: 'background-color 0.3s'
        }}
      />
    ));
  };

  const getMediaUrl = async (id: string) => {
    try {
      // console.log('VideoPlayer: Fetching URL for mediaId:', id);
      const response = await api.get(`/media/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.data && response.data.url) {
        setMediaUrl(response.data.url);
        console.log('VideoPlayer: Successfully loaded media URL:', response.data.url);
      } else {
        console.warn('VideoPlayer: API returned empty URL for id:', id);
        setMediaUrl('');
      }
    } catch (error) {
      console.error('VideoPlayer: Error fetching media URL:', error);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          margin: '0 auto',
          aspectRatio: '16 / 9',
          backgroundColor: 'black',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <video
          key={mediaUrl || 'default'}
          ref={videoRef}
          controls
          muted={isMockView}
          src={mediaUrl}
          style={{
            height: '100%',
            width: '100%',
            objectFit: 'contain',
            borderRadius: '8px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}
          autoPlay={isMockView}
          onLoadedData={() => {
            console.log('VideoPlayer: Video loaded successfully');
          }}
        />
      </div>
      {/* Buffer Health Bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          borderRadius: '8px 8px 0 0',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${bufferHealth * 100}%`,
            backgroundColor: bufferHealth > 0.6 ? '#4ade80' : bufferHealth > 0.3 ? '#facc15' : '#ef4444',
            transition: 'width 0.3s, background-color 0.3s'
          }}
        />
      </div>

      {/* Buffering Overlay */}
      {/* {_buffering && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            padding: '16px 24px',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              border: '3px solid rgba(255, 255, 255, 0.3)',
              borderTop: '3px solid white',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}
          />
          <span>Buffering for smooth playback...</span>
        </div>
      )} */}

      {/* {isHost && savedPosition && savedPosition > 10 && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          padding: '24px',
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          borderRadius: 12,
          minWidth: 320,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.8)'
        }}>
          <div style={{ marginBottom: 16, fontSize: 18, fontWeight: 600 }}>
            Resume where you left off?
          </div>
          <div style={{ marginBottom: 20, color: '#9ca3af', fontSize: 14 }}>
            Last position: {Math.floor(savedPosition / 60)}:{Math.floor(savedPosition % 60).toString().padStart(2, '0')}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={onResumePosition}
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: 'rgba(200, 118, 255, 0.85)',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              Resume
            </button>
            <button
              onClick={onDismissResume}
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: '#374151',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              Start Over
            </button>
          </div>
        </div>
      )} */}

      {/* Sync Quality Indicator */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          display: 'flex',
          gap: 4,
          padding: 8,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          borderRadius: 8
        }}
      >
        {getSyncDots()}
      </div>

      {/* Host Badge */}
      {isHost && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            padding: '4px 12px',
            backgroundColor: 'rgba(59, 130, 246, 0.9)',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600
          }}
        >
          HOST
        </div>
      )}

      {(!isHost && !isMockView) && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            borderRadius: 6,
            fontSize: 12,
            cursor: 'pointer'
          }}
          onClick={() => onSyncToggle(!syncEnabled)}
        >
          <div style={{
            width: 32,
            height: 18,
            backgroundColor: syncEnabled ? '#10b981' : '#6b7280',
            borderRadius: 9,
            position: 'relative',
            transition: 'background-color 0.2s'
          }}>
            <div style={{
              width: 14,
              height: 14,
              backgroundColor: 'white',
              borderRadius: '50%',
              position: 'absolute',
              top: 2,
              left: syncEnabled ? 16 : 2,
              transition: 'left 0.2s'
            }} />
          </div>
          <span style={{ fontWeight: 600 }}>
            {syncEnabled ? 'Sync' : 'Independent'}
          </span>
        </div>
      )}

      {/* Resync UI */}
      {showResyncUI && !isHost && (
        <div
          style={{
            position: 'absolute',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '12px 20px',
            backgroundColor: 'rgba(239, 68, 68, 0.95)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
          }}
        >
          <span style={{ fontSize: 14 }}>
            {Math.abs(drift) > 12
              ? `Severely out of sync (${Math.abs(drift).toFixed(1)}s)`
              : `Out of sync by ${Math.abs(drift).toFixed(1)}s`
            }
          </span>
          <button
            onClick={handleResync}
            style={{
              padding: '6px 16px',
              backgroundColor: '#fff',
              color: '#ef4444',
              border: 'none',
              borderRadius: 6,
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            Sync Now
          </button>
        </div>
      )}

      {/* Debug Info */}
      {/* <div
        style={{
          marginTop: 16,
          padding: 16,
          backgroundColor: 'rgba(17, 24, 39, 0.8)',
          borderRadius: 8,
          fontFamily: 'monospace',
          fontSize: 12
        }}
      >
        <div>Role: {isHost ? 'HOST' : 'Viewer'}</div>
        <div>Drift: {drift.toFixed(3)}s</div>
        <div>Strategy: {_strategy}</div>
        <div>playback rate: {videoRef.current?.playbackRate.toFixed(3) || '1.000'}</div>
        <div>buffer health: {(bufferHealth * 100).toFixed(0)}%</div>
        <div>buffering: {_buffering ? 'Yes' : 'No'}</div>
      </div> */}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}