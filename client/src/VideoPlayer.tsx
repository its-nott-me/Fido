import { useEffect, useRef, useState } from 'react';
import { SyncEngine } from './SyncEngine';

interface VideoPlayerProps {
  syncEngine: SyncEngine | null;
  isHost: boolean;
}

type DriftStrategy = 'locked' | 'soft-convergence' | 'show-ui' | 'force-resync';

export default function VideoPlayer({ syncEngine, isHost }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [drift, setDrift] = useState(0);
  const [strategy, setStrategy] = useState<DriftStrategy>('locked');
  const [showResyncUI, setShowResyncUI] = useState(false);

  useEffect(() => {
    if (videoRef.current && syncEngine) {
      syncEngine.setVideoElement(videoRef.current);
      
      syncEngine.onDriftChange = (newDrift, newStrategy) => {
        setDrift(newDrift);
        setStrategy(newStrategy);
        setShowResyncUI(newStrategy === 'show-ui' || newStrategy === 'force-resync');
      };
    }
  }, [syncEngine]);

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

  return (
    <div style={{ position: 'relative' }}>
      <video
        ref={videoRef}
        controls
        style={{
          width: '100%',
          maxWidth: '800px',
          borderRadius: '8px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
        }}
      >
        <source
          src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
          type="video/mp4"
        />
      </video>

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
      <div
        style={{
          marginTop: 16,
          padding: 16,
          backgroundColor: 'rgba(17, 24, 39, 0.8)',
          borderRadius: 8,
          fontFamily: 'monospace',
          fontSize: 12
        }}
      >
        <div>Role: {isHost ? 'HOST' : 'VIEWER'}</div>
        <div>Drift: {drift.toFixed(3)}s</div>
        <div>Strategy: {strategy}</div>
        <div>Playback Rate: {videoRef.current?.playbackRate.toFixed(3) || '1.000'}</div>
      </div>
    </div>
  );
}