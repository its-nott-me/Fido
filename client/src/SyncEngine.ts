import { ClockSync } from './ClockSync';
import { WebRTCManager } from './WebRTCManager';

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
  private webrtc: WebRTCManager;
  private isHost: boolean = false;
  private version: number = 0;
  private sessionId: string = '';
  private positionSaveInterval: number | null = null;
  private snapshotInterval: number | null = null;
  private serverBackupInterval: number | null = null;
  private driftCheckInterval: number | null = null;
  private currentDrift: number = 0;
  private targetPlaybackRate: number = 1.0;
  private isConverging: boolean = false;
  private bufferCheckPending: boolean = false;
  private syncEnabled: boolean = true;
  private lastSnapshot: SyncSnapshot | null = null;

  // Callbacks
  onDriftChange?: (drift: number, strategy: DriftStrategy) => void;
  onStateChange?: (state: SyncState) => void;
  onBufferStatus?: (buffering: boolean, bufferHealth: number) => void;

  constructor(webrtc: WebRTCManager, clockSync: ClockSync) {
    this.webrtc = webrtc;
    this.clockSync = clockSync;

    // Handle incoming data channel messages
    this.webrtc.onDataChannelMessage = (fromPeerId, message) => {
      this.handleDataChannelMessage(fromPeerId, message);
    };
  }

  setSessionId(sessionId: string) {
    this.sessionId = sessionId;
    this.startSavingPosition();
  }

  private startSavingPosition() {
    // Save position every 5 seconds
    this.positionSaveInterval = window.setInterval(() => {
      if (this.videoElement && this.sessionId) {
        const position = this.videoElement.currentTime;
        localStorage.setItem(`session-${this.sessionId}-position`, position.toString());
        localStorage.setItem(`session-${this.sessionId}-timestamp`, Date.now().toString());
      }
    }, 5000);
  }

  getSavedPosition(): number | null {
    if (!this.sessionId) return null;

    const savedPosition = localStorage.getItem(`session-${this.sessionId}-position`);
    const savedTime = localStorage.getItem(`session-${this.sessionId}-timestamp`);

    if (!savedPosition || !savedTime) return null;

    // Only resume if saved within last 24 hours
    const hoursSinceSave = (Date.now() - parseInt(savedTime)) / (1000 * 60 * 60);
    if (hoursSinceSave > 24) {
      this.clearSavedPosition();
      return null;
    }

    return parseFloat(savedPosition);
  }

  clearSavedPosition() {
    if (this.sessionId) {
      localStorage.removeItem(`session-${this.sessionId}-position`);
      localStorage.removeItem(`session-${this.sessionId}-timestamp`);
    }
  }

  private handleDataChannelMessage(fromPeerId: string, message: any) {
    switch (message.type) {
      case 'clock-ping':
        // Respond to clock ping
        if (this.isHost) {
          const now = Date.now();
          this.webrtc.sendTo(fromPeerId, {
            type: 'clock-pong',
            clientSendTime: message.timestamp,
            serverReceiveTime: now,
            serverSendTime: now
          });
        }
        break;

      case 'clock-pong':
        this.clockSync.handlePong(
          message.clientSendTime,
          message.serverReceiveTime,
          message.serverSendTime
        );
        break;

      case 'sync-snapshot':
        this.handleSyncSnapshot({
          position: message.position,
          playing: message.playing,
          timestamp: message.timestamp,
          version: message.version
        });
        break;

      case 'command':
        this.handleCommand(message.state, message.version);
        break;

      case 'request-sync':
        if (this.isHost) {
          this.broadcastCommand();
        }
    }
  }

  setVideoElement(video: HTMLVideoElement) {
    this.videoElement = video;

    // Listen to video events
    video.addEventListener('play', this.handleLocalPlay);
    video.addEventListener('pause', this.handleLocalPause);
    video.addEventListener('seeked', this.handleLocalSeek);
    video.addEventListener('waiting', this.handleBuffering);
    video.addEventListener('canplay', this.handleCanPlay);
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

  setSyncEnabled(enabled: boolean) {
    this.syncEnabled = enabled;

    if (!enabled) {
      // Stop corrections when disabled
      this.stopSoftConvergence();
      if (this.driftCheckInterval) {
        clearInterval(this.driftCheckInterval);
        this.driftCheckInterval = null;
      }
    } else if (!this.isHost) {
      // Resume drift correction when re-enabled
      this.startDriftCorrection();
      this.forceResync();
    }
  }

  private startBroadcastingSnapshots() {
    // Host broadcasts sync snapshots at 2Hz via WebRTC
    this.snapshotInterval = window.setInterval(() => {
      if (!this.videoElement) return;

      const snapshot = {
        type: 'sync-snapshot',
        position: this.videoElement.currentTime,
        playing: !this.videoElement.paused,
        timestamp: Date.now(),
        version: this.version
      };

      this.webrtc.broadcast(snapshot);
    }, 500);

    // Backup state to server every 5 seconds for persistence
    this.serverBackupInterval = window.setInterval(() => {
      if (!this.videoElement || !this.isHost) return;

      this.webrtc.sendSignalingMessage({
        type: 'sync-snapshot',
        position: this.videoElement.currentTime,
        playing: !this.videoElement.paused,
        timestamp: Date.now()
      });
    }, 5000);
  }

  private stopBroadcastingSnapshots() {
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }
  }

  private startDriftCorrection() {
    if (this.driftCheckInterval) {
      clearInterval(this.driftCheckInterval);
    }

    // console.log('[Sync] Starting drift correction loop');

    // Check drift every 500ms
    this.driftCheckInterval = window.setInterval(() => {
      this.checkAndCorrectDrift();
      this.checkBufferHealth();
    }, 500);
  }

  private checkBufferHealth() {
    if (!this.videoElement || this.videoElement.paused) return;

    const buffered = this.videoElement.buffered;
    if (buffered.length === 0) {
      this.onBufferStatus?.(true, 0);
      return;
    }

    const currentTime = this.videoElement.currentTime;
    let bufferEnd = 0;

    // Find buffer range that contains current time
    for (let i = 0; i < buffered.length; i++) {
      if (buffered.start(i) <= currentTime && currentTime <= buffered.end(i)) {
        bufferEnd = buffered.end(i);
        break;
      }
    }

    const bufferAhead = bufferEnd - currentTime;
    const bufferHealth = Math.min(bufferAhead / 5, 1); // 5 seconds = 100% health

    this.onBufferStatus?.(bufferAhead < 4, bufferHealth);
  }

  private async checkBufferBeforePlay(): Promise<boolean> {
    if (!this.videoElement) return false;

    const buffered = this.videoElement.buffered;
    if (buffered.length === 0) return false;

    const currentTime = this.videoElement.currentTime;
    let bufferAhead = 0;

    for (let i = 0; i < buffered.length; i++) {
      if (buffered.start(i) <= currentTime && currentTime <= buffered.end(i)) {
        bufferAhead = buffered.end(i) - currentTime;
        break;
      }
    }

    // Need at least 3 seconds buffered
    if (bufferAhead < 3) {
      this.bufferCheckPending = true;
      this.onBufferStatus?.(true, bufferAhead / 5);

      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.videoElement) {
            clearInterval(checkInterval);
            resolve(false);
            return;
          }

          const buffered = this.videoElement.buffered;
          let newBufferAhead = 0;

          for (let i = 0; i < buffered.length; i++) {
            const start = buffered.start(i);
            const end = buffered.end(i);
            if (start <= this.videoElement.currentTime &&
              this.videoElement.currentTime <= end) {
              newBufferAhead = end - this.videoElement.currentTime;
              break;
            }
          }

          if (newBufferAhead >= 3) {
            clearInterval(checkInterval);
            this.bufferCheckPending = false;
            this.onBufferStatus?.(false, newBufferAhead / 5);
            resolve(true);
          }
        }, 100);

        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          this.bufferCheckPending = false;
          resolve(false);
        }, 10000);
      });
    }

    return true;
  }

  private handleBuffering = () => {
    this.onBufferStatus?.(true, 0);
  };

  private handleCanPlay = () => {
    if (!this.bufferCheckPending) {
      this.checkBufferHealth();
    }
  };

  private checkAndCorrectDrift() {
    if (!this.videoElement) {
      return;
    }

    if (this.lastSnapshot) {
      const now = this.clockSync.getServerTime();
      const timeSinceSnapshot = (now - this.lastSnapshot.timestamp) / 1000;
      const expectedPosition = this.lastSnapshot.position +
        (this.lastSnapshot.playing ? timeSinceSnapshot : 0);

      this.currentDrift = this.videoElement.currentTime - expectedPosition;
    }

    const absDrift = Math.abs(this.currentDrift);
    let strategy: DriftStrategy = 'locked';

    if (absDrift < 0.4) {
      strategy = 'locked';
      this.stopSoftConvergence();
    } else if (absDrift < 2.0) {
      strategy = 'soft-convergence';
      this.applySoftConvergence(this.currentDrift);
    } else if (absDrift < 12.0) {
      strategy = 'show-ui';
      this.stopSoftConvergence();
    } else {
      strategy = 'force-resync';
      this.stopSoftConvergence();
    }

    // if (strategy !== 'locked' || absDrift > 0.1) {
    //   console.log(`[Drift] ${this.currentDrift.toFixed(3)}s | Strategy: ${strategy}`);
    // }

    this.onDriftChange?.(this.currentDrift, strategy);
  }

  private applySoftConvergence(drift: number) {
    if (!this.videoElement || this.isConverging) return;

    this.isConverging = true;
    const maxRateAdjust = 0.030;

    const rateAdjust = Math.min(maxRateAdjust, Math.abs(drift) / 10);
    this.targetPlaybackRate = drift > 0 ? 1 - rateAdjust : 1 + rateAdjust;

    this.smoothRateTransition(this.videoElement.playbackRate, this.targetPlaybackRate, 500);

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
    if (!this.videoElement || this.isHost || !this.syncEnabled) return;

    this.lastSnapshot = snapshot;

    const now = this.clockSync.getServerTime();
    const timeSinceSnapshot = (now - snapshot.timestamp) / 1000;
    const expectedPosition = snapshot.position + (snapshot.playing ? timeSinceSnapshot : 0);

    this.currentDrift = this.videoElement.currentTime - expectedPosition;

    // State convergence: if we are stalled (paused but host is playing) 
    // and drift is growing, force a command update
    if (snapshot.playing && this.videoElement.paused && Math.abs(this.currentDrift) > 1.0) {
      console.log(`[Sync] State mismatch detected (Peer: Paused, Host: Playing). Forcing resync...`);
      this.handleCommand({
        playing: true,
        position: snapshot.position,
        timestamp: snapshot.timestamp
      }, snapshot.version);
    }
    // Conversly, if host is paused but we are playing
    else if (!snapshot.playing && !this.videoElement.paused && Math.abs(this.currentDrift) > 1.0) {
      console.log(`[Sync] State mismatch detected (Peer: Playing, Host: Paused). Forcing pause...`);
      this.handleCommand({
        playing: false,
        position: snapshot.position,
        timestamp: snapshot.timestamp
      }, snapshot.version);
    }

    // Update last snapshot for drift calculations
    this.lastSnapshot = snapshot;
  }

  handleCommand(state: SyncState, version: number) {
    if (!this.videoElement || version <= this.version || !this.syncEnabled) return;

    this.version = version;

    // For pause commands, pause FIRST, then seek
    if (!state.playing && !this.videoElement.paused) {
      this.videoElement.pause();

      // Then seek if needed
      if (Math.abs(this.videoElement.currentTime - state.position) > 0.5) {
        this.videoElement.currentTime = state.position;
      }
    }
    // For play commands, seek first if needed, then play
    else if (state.playing && this.videoElement.paused) {
      if (Math.abs(this.videoElement.currentTime - state.position) > 0.5) {
        this.videoElement.currentTime = state.position;
      }

      this.videoElement.play().catch(() => {
        console.warn('Autoplay prevented - user interaction required');
        this.onStateChange?.({ ...state, playing: false });
      });
    }
    // For position updates during playback
    else if (Math.abs(this.videoElement.currentTime - state.position) > 0.5) {
      this.videoElement.currentTime = state.position;
    }

    this.onStateChange?.(state);
  }

  private handleLocalPlay = async () => {
    if (!this.isHost || !this.videoElement) return;

    // Check buffer before allowing play
    const hasBuffer = await this.checkBufferBeforePlay();

    if (!hasBuffer) {
      // Pause if buffer is insufficient
      this.videoElement.pause();
      return;
    }

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

    this.webrtc.broadcast({
      type: 'command',
      version: this.version,
      state
    });

    this.onStateChange?.(state);
  }

  forceResync() {
    if (!this.videoElement || this.isHost) return;

    this.webrtc.broadcast({
      type: 'request-sync',
      fromPeerId: this.webrtc['peerId'],
    })
  }

  destroy() {
    this.stopBroadcastingSnapshots();

    if (this.driftCheckInterval) {
      clearInterval(this.driftCheckInterval);
    }

    if (this.positionSaveInterval) {
      clearInterval(this.positionSaveInterval);
    }

    if (this.serverBackupInterval) {
      clearInterval(this.serverBackupInterval);
    }

    if (this.videoElement) {
      this.videoElement.removeEventListener('play', this.handleLocalPlay);
      this.videoElement.removeEventListener('pause', this.handleLocalPause);
      this.videoElement.removeEventListener('seeked', this.handleLocalSeek);
      this.videoElement.removeEventListener('waiting', this.handleBuffering);
      this.videoElement.removeEventListener('canplay', this.handleCanPlay);
    }
  }
}