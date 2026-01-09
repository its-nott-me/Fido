interface ClockSample {
  offset: number;
  rtt: number;
  timestamp: number;
}

export class ClockSync {
  private samples: ClockSample[] = [];
  private maxSamples = 20;
  private currentOffset = 0;
  private confidence = 0;
  private ws: WebSocket | null = null;
  private pingInterval: number | null = null;

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.startPinging();
  }

  private startPinging() {
    // Ping every 2 seconds
    this.pingInterval = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'clock-ping',
          timestamp: Date.now()
        }));
      }
    }, 2000);
  }

  handlePong(clientSendTime: number, serverReceiveTime: number, serverSendTime: number) {
    const clientReceiveTime = Date.now();
    
    // Calculate RTT
    const rtt = (clientReceiveTime - clientSendTime) - (serverSendTime - serverReceiveTime);
    
    // Calculate offset (assuming symmetric network delay)
    const offset = ((serverReceiveTime - clientSendTime) + (serverSendTime - clientReceiveTime)) / 2;

    // Add sample
    this.samples.push({ offset, rtt, timestamp: Date.now() });
    
    // Keep only recent samples
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }

    // Calculate smoothed offset (exponential weighted moving average)
    const alpha = 0.3;
    this.currentOffset = alpha * offset + (1 - alpha) * this.currentOffset;

    // Calculate confidence based on RTT stability
    if (this.samples.length >= 5) {
      const recentRtts = this.samples.slice(-10).map(s => s.rtt);
      const avgRtt = recentRtts.reduce((a, b) => a + b, 0) / recentRtts.length;
      const variance = recentRtts.reduce((sum, rtt) => sum + Math.pow(rtt - avgRtt, 2), 0) / recentRtts.length;
      const stdDev = Math.sqrt(variance);
      
      // High stdDev = low confidence
      this.confidence = Math.max(0, Math.min(1, 1 - (stdDev / 100)));
    }
  }

  getOffset(): number {
    return this.currentOffset;
  }

  getConfidence(): number {
    return this.confidence;
  }

  getServerTime(): number {
    return Date.now() + this.currentOffset;
  }

  destroy() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
  }
}