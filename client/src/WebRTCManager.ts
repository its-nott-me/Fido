export interface DataChannelMessage {
  type: string;
  [key: string]: any;
}

export class WebRTCManager {
  private peerId: string;
  private connections: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private ws: WebSocket;

  // Callbacks
  onDataChannelMessage?: (fromPeerId: string, message: DataChannelMessage) => void;
  onConnectionStateChange?: (peerId: string, state: RTCPeerConnectionState) => void;

  constructor(peerId: string, ws: WebSocket) {
    this.peerId = peerId;
    this.ws = ws;
  }

  async createOffer(targetPeerId: string) {
    const pc = this.createPeerConnection(targetPeerId);

    // Create data channel (caller creates it)
    const dc = pc.createDataChannel('sync', {
      ordered: true,
      maxRetransmits: 3
    });

    this.setupDataChannel(targetPeerId, dc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Send offer through signaling server
    this.ws.send(JSON.stringify({
      type: 'webrtc-offer',
      targetPeerId,
      offer: offer
    }));
  }

  async handleOffer(fromPeerId: string, offer: RTCSessionDescriptionInit) {
    const pc = this.createPeerConnection(fromPeerId);

    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // Send answer through signaling server
    this.ws.send(JSON.stringify({
      type: 'webrtc-answer',
      targetPeerId: fromPeerId,
      answer: answer
    }));
  }

  async handleAnswer(fromPeerId: string, answer: RTCSessionDescriptionInit) {
    const pc = this.connections.get(fromPeerId);
    if (pc) {
      await pc.setRemoteDescription(answer);
    }
  }

  async handleIceCandidate(fromPeerId: string, candidate: RTCIceCandidateInit) {
    const pc = this.connections.get(fromPeerId);
    if (pc) {
      await pc.addIceCandidate(candidate);
    }
  }

  private createPeerConnection(peerId: string): RTCPeerConnection {
    if (this.connections.has(peerId)) {
      return this.connections.get(peerId)!;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.ws.send(JSON.stringify({
          type: 'webrtc-ice-candidate',
          targetPeerId: peerId,
          candidate: event.candidate
        }));
      }
    };

    // Handle data channel from remote peer (for answerer)
    pc.ondatachannel = (event) => {
      this.setupDataChannel(peerId, event.channel);
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      // console.log(`Connection to ${peerId}: ${pc.connectionState}`);
      this.onConnectionStateChange?.(peerId, pc.connectionState);

      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.closeConnection(peerId);
      }
    };

    this.connections.set(peerId, pc);
    return pc;
  }

  private setupDataChannel(peerId: string, channel: RTCDataChannel) {
    channel.onopen = () => {
      // console.log(`Data channel to ${peerId} opened`);
    };

    channel.onclose = () => {
      // console.log(`Data channel to ${peerId} closed`);
      this.dataChannels.delete(peerId);
    };

    channel.onerror = (error) => {
      console.error(`Data channel error with ${peerId}:`, error);
    };

    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.onDataChannelMessage?.(peerId, message);
      } catch (err) {
        console.error('Error parsing data channel message:', err);
      }
    };

    this.dataChannels.set(peerId, channel);
  }

  broadcast(message: DataChannelMessage) {
    const messageStr = JSON.stringify(message);
    this.dataChannels.forEach((channel, peerId) => {
      if (channel.readyState === 'open') {
        try {
          channel.send(messageStr);
        } catch (err) {
          console.error(`Error sending to ${peerId}:`, err);
        }
      }
    });
  }

  sendTo(peerId: string, message: DataChannelMessage) {
    const channel = this.dataChannels.get(peerId);
    if (channel && channel.readyState === 'open') {
      try {
        channel.send(JSON.stringify(message));
      } catch (err) {
        console.error(`Error sending to ${peerId}:`, err);
      }
    }
  }

  sendSignalingMessage(message: any) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  getConnectedPeers(): string[] {
    return Array.from(this.dataChannels.keys()).filter(
      peerId => this.dataChannels.get(peerId)?.readyState === 'open'
    );
  }

  isConnectedTo(peerId: string): boolean {
    const channel = this.dataChannels.get(peerId);
    return channel?.readyState === 'open';
  }

  private closeConnection(peerId: string) {
    const pc = this.connections.get(peerId);
    if (pc) {
      pc.close();
      this.connections.delete(peerId);
    }

    const dc = this.dataChannels.get(peerId);
    if (dc) {
      dc.close();
      this.dataChannels.delete(peerId);
    }
  }

  destroy() {
    this.connections.forEach((pc) => pc.close());
    this.dataChannels.forEach((dc) => dc.close());
    this.connections.clear();
    this.dataChannels.clear();
    console.log(this.peerId);
  }
}