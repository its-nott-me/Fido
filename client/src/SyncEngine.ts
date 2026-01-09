import { ClockSync } from './ClockSync';

export interface SyncState {
  playing: boolean;
  position: number;
  timestamp: number;
}

export interface SyncSnapshot {
  position: number;
  playing: boolean;
  timestamp: number;
  version: number;
}

type DriftStrategy = 'locked' | 'soft-convergence' | 'show-ui' | 'force-resync';

export class SyncEngine {
  private videoElement: HTMLVideoElement | null = null;
  private clockSync: ClockSync;
  private ws: WebSocket;
  private isHost: boolean = false;
  private version: number = 0;
  private snapshotInterval: number | null = null;
  private driftCheckInterval: number | null = null;
  private currentDrift: number = 0;
  private targetPlaybackRate: number = 1.0;
  private isConverging: boolean = false;

  // Callbacks
  onDriftChange?: (drift: number, strategy: DriftStrategy) => void;
  onStateChange?: (state: SyncState) => void;

  constructor(ws: WebSocket, clockSync: ClockSync) {
    this.ws = ws;
    this.clockSync = clockSync;
  }

  setVideoElement(video: HTMLVideoElement) {
    this.videoElement = video;
    
    // Listen to video events
    video.addEventListener('play', this.handleLocalPlay);
    video.addEventListener('pause', this.handleLocalPause);
    video.addEventListener('seeked', this.handleLocalSeek);
  }

  setIsHost(isHost: boolean) {
    this.isHost = isHost;

    if (isHost) {
      this.startBroadcastingSnapshots();
    } else {
      this.stopBroadcastingSnapshots();
      this.startDriftCorrection();
    }
  }

  private startBroadcastingSnapshots() {
    // Host broadcasts sync snapshots at 2Hz
    this.snapshotInterval = window.setInterval(() => {
      if (!this.videoElement) return;

      const snapshot: SyncSnapshot = {
        position: this.videoElement.currentTime,
        playing: !this.videoElement.paused,
        timestamp: this.clockSync.getServerTime(),
        version: this.version
      };

      this.ws.send(JSON.stringify({
        type: 'sync-snapshot',
        ...snapshot
      }));
    }, 500);
  }

  private stopBroadcastingSnapshots() {
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }
  }

  private startDriftCorrection() {
    // Check drift every 500ms
    this.driftCheckInterval = window.setInterval(() => {
      this.checkAndCorrectDrift();
    }, 500);
  }

  private checkAndCorrectDrift() {
    // This is called after receiving sync snapshots
    // The actual drift calculation happens in handleSyncSnapshot
    if (!this.videoElement || this.clockSync.getConfidence() < 0.5) {
      return;
    }

    const absDrift = Math.abs(this.currentDrift);
    let strategy: DriftStrategy = 'locked';

    if (absDrift < 0.4) {
      // Less than 400ms - locked, do nothing
      strategy = 'locked';
      this.stopSoftConvergence();
    } else if (absDrift < 2.0) {
      // 400ms to 2s - soft convergence
      strategy = 'soft-convergence';
      this.applySoftConvergence(this.currentDrift);
    } else if (absDrift < 12.0) {
      // 2s to 12s - show UI
      strategy = 'show-ui';
      this.stopSoftConvergence();
    } else {
      // Over 12s - force resync
      strategy = 'force-resync';
      this.stopSoftConvergence();
    }

    this.onDriftChange?.(this.currentDrift, strategy);
  }

  private applySoftConvergence(drift: number) {
    if (!this.videoElement || this.isConverging) return;

    this.isConverging = true;
    const maxRateAdjust = 0.03; // Up to 3% speed change
    
    // Calculate proportional rate adjustment
    const rateAdjust = Math.min(maxRateAdjust, Math.abs(drift) / 10);
    this.targetPlaybackRate = drift > 0 ? 1 + rateAdjust : 1 - rateAdjust;

    // Smoothly ramp to target rate
    this.smoothRateTransition(this.videoElement.playbackRate, this.targetPlaybackRate, 500);

    // After some time, ramp back down
    setTimeout(() => {
      if (this.videoElement && Math.abs(this.currentDrift) < 0.5) {
        this.smoothRateTransition(this.videoElement.playbackRate, 1.0, 500);
        this.isConverging = false;
      }
    }, 3000);
  }

  private smoothRateTransition(from: number, to: number, duration: number) {
    if (!this.videoElement) return;

    const startTime = Date.now();
    const animate = () => {
      if (!this.videoElement) return;

      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Cubic ease
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      this.videoElement.playbackRate = from + (to - from) * eased;

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  private stopSoftConvergence() {
    if (this.videoElement && this.isConverging) {
      this.videoElement.playbackRate = 1.0;
      this.isConverging = false;
    }
  }

  handleSyncSnapshot(snapshot: SyncSnapshot) {
    if (!this.videoElement || this.isHost) return;

    // Calculate expected position
    const now = this.clockSync.getServerTime();
    const timeSinceSnapshot = (now - snapshot.timestamp) / 1000; // Convert to seconds
    const expectedPosition = snapshot.position + (snapshot.playing ? timeSinceSnapshot : 0);
    
    // Calculate drift
    this.currentDrift = this.videoElement.currentTime - expectedPosition;

    // Update version
    if (snapshot.version > this.version) {
      this.version = snapshot.version;
    }
  }

  handleCommand(state: SyncState, version: number) {
    if (!this.videoElement || version <= this.version) return;

    this.version = version;

    // Apply state atomically
    if (Math.abs(this.videoElement.currentTime - state.position) > 0.5) {
      this.videoElement.currentTime = state.position;
    }

    if (state.playing && this.videoElement.paused) {
      this.videoElement.play();
    } else if (!state.playing && !this.videoElement.paused) {
      this.videoElement.pause();
    }

    this.onStateChange?.(state);
  }

  private handleLocalPlay = () => {
    if (!this.isHost || !this.videoElement) return;
    this.broadcastCommand();
  };

  private handleLocalPause = () => {
    if (!this.isHost || !this.videoElement) return;
    this.broadcastCommand();
  };

  private handleLocalSeek = () => {
    if (!this.isHost || !this.videoElement) return;
    this.broadcastCommand();
  };

  private broadcastCommand() {
    if (!this.videoElement) return;

    this.version++;
    const state: SyncState = {
      playing: !this.videoElement.paused,
      position: this.videoElement.currentTime,
      timestamp: Date.now()
    };

    this.ws.send(JSON.stringify({
      type: 'command',
      version: this.version,
      state
    }));

    this.onStateChange?.(state);
  }

  forceResync() {
    // Request current state from host
    this.ws.send(JSON.stringify({
      type: 'request-sync'
    }));
  }

  destroy() {
    this.stopBroadcastingSnapshots();
    
    if (this.driftCheckInterval) {
      clearInterval(this.driftCheckInterval);
    }

    if (this.videoElement) {
      this.videoElement.removeEventListener('play', this.handleLocalPlay);
      this.videoElement.removeEventListener('pause', this.handleLocalPause);
      this.videoElement.removeEventListener('seeked', this.handleLocalSeek);
    }
  }
}