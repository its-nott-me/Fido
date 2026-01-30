# **Fido - Watch Together**

> **Real-time synchronized video playback for distributed viewing experiences**

> [!IMPORTANT]
> **🚧 Development Status**: This project is actively under development. Expect bugs and breaking changes.  
> **Found a bug?** Please [open an issue](https://github.com/yourusername/fido/issues) or reach out with suggestions!

Have you ever tried watching a movie with friends miles apart? You press play, they press play. Someone's ahead, someone's behind. "Wait, pause!" "What timestamp are you at?"

**Fido** fixes that. Instead of fragile play/pause commands, it uses **perceptual synchronization** - continuous convergence that keeps everyone in sync below human perception (~200ms).

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Features](#-features)
- [Getting Started](#-getting-started)
- [How It Works](#-how-it-works)
- [Tech Stack](#-tech-stack)

---

## 🎯 Overview

Fido treats watching together as a **continuous convergence problem**. Every participant moves toward the same desired state:

> *"The video should be playing at 45.3 seconds."*

If someone drifts, the system gently nudges playback until everyone feels in sync - no snapping, rewinding, or stuttering.

### Drift Tolerance Strategy
- `< 0.4s` → **Locked** (no correction)
- `0.4s - 2.0s` → **Soft convergence** (playback rate ±3%)
- `2.0s - 12.0s` → **Show resync button**
- `> 12.0s` → **Force resync**

---

## 🏗️ Architecture

### System Overview

```mermaid
graph TB
    subgraph Client
        UI[React UI]
        VP[VideoPlayer]
        SE[SyncEngine]
        CS[ClockSync]
        WM[WebRTCManager]
        HLS[HLS.js]
    end
    
    subgraph Server
        WS[WebSocket Relay]
        API[Express API]
        DB[(PostgreSQL)]
        S3[S3/R2 Storage]
    end
    
    UI --> VP
    VP --> SE
    SE --> CS
    SE --> WM
    VP --> HLS
    
    WM -.P2P Data.-> WM
    WM --> WS
    UI --> API
    API --> DB
    API --> S3
    
    style SE fill:#4CAF50
    style WM fill:#2196F3
```

### Sync Flow

```mermaid
sequenceDiagram
    participant Host
    participant Server
    participant Peer
    
    Note over Host,Peer: Session Join
    Host->>Server: join(sessionId)
    Server->>Host: session-state(host=true)
    Peer->>Server: join(sessionId)
    Server->>Peer: session-state(peers)
    
    Note over Host,Peer: WebRTC P2P Setup
    Host->>Peer: Establish data channel
    
    Note over Host,Peer: Clock Sync (NTP-style)
    Peer->>Host: clock-ping(t0)
    Host->>Peer: clock-pong(t1, t2)
    Peer->>Peer: Calculate offset & RTT
    
    Note over Host,Peer: Continuous Sync (500ms)
    loop Every 500ms
        Host->>Peer: sync-snapshot(pos, playing, ts)
        Peer->>Peer: Calculate drift
        Peer->>Peer: Apply correction
    end
```

---

## ✨ Features

**Core Sync**
- ✅ Real-time video synchronization (< 200ms accuracy)
- ✅ WebRTC P2P data channels (low latency)
- ✅ NTP-style clock synchronization
- ✅ Automatic host migration
- ✅ HLS adaptive streaming

**User Features**
- ✅ Password-protected rooms
- ✅ Real-time chat
- ✅ Live presence counter
- ✅ Video upload support
- ✅ Session persistence

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL
- AWS S3 or Cloudflare R2
- FFmpeg

### Quick Start

```bash
# Clone repository
git clone https://github.com/yourusername/fido.git
cd fido

# Install dependencies
cd server && npm install
cd ../client && npm install

# Configure environment (see .env.example)
# Set up database
cd server && npm run migrate

# Start servers
npm run dev  # Terminal 1 (server)
cd ../client && npm run dev  # Terminal 2 (client)
```

**Environment Variables**

`server/.env`:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/fido
JWT_SECRET=your-secret-key
R2_ACCOUNT_ID=your-r2-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=your-bucket-name
R2_PUBLIC_URL=https://your-cdn-url.com
frontendURL=http://localhost:5173
```

`client/.env`:
```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

Navigate to `http://localhost:5173`

---

##  How It Works

### 1. Session Join
- Client connects via WebSocket
- First client becomes **host**, others are **peers**
- WebRTC P2P connections established

### 2. Clock Synchronization
NTP-style protocol calculates time offset:
```
offset = ((t1 - t0) + (t2 - t3)) / 2
RTT = (t3 - t0) - (t2 - t1)
```

### 3. Continuous Sync
Host broadcasts snapshots every 500ms:
```typescript
{
  position: 45.3,
  playing: true,
  timestamp: 1234567,
  version: 42
}
```

Peers calculate drift and apply corrections:
```typescript
const drift = currentTime - expectedPosition;
if (drift > 0.4s && drift < 2.0s) {
  playbackRate = 1.0 ± 0.03; // Soft convergence
}
```

### 4. Host Migration
When host disconnects, server elects new host (highest peer ID) and broadcasts `host-changed` event.

---

## �️ Tech Stack

**Frontend**: React 19, TypeScript, Vite, HLS.js, WebRTC  
**Backend**: Node.js, Express, WebSocket, PostgreSQL, FFmpeg  
**Infrastructure**: Cloudflare R2, PostgreSQL

### Project Structure
```
fido/
├── client/src/
│   ├── SyncEngine.ts        # Core sync algorithm
│   ├── ClockSync.tsx        # NTP-style clock sync
│   ├── WebRTCManager.ts     # P2P connections
│   ├── VideoPlayer.tsx      # HLS player
│   └── pages/RoomPage.tsx   # Main room UI
├── server/
│   ├── index.js             # WebSocket + Express
│   ├── routes/              # API endpoints
│   └── services/            # Background jobs
```

---

## 🤝 Contributing

**This project is in active development!** Contributions, bug reports, and suggestions are highly appreciated.

- 🐛 **Found a bug?** [Open an issue](https://github.com/yourusername/fido/issues)
- 💡 **Have an idea?** Start a [discussion](https://github.com/yourusername/fido/discussions)

---

## 📄 License

ISC License

---

## 🙏 Acknowledgments

Built with inspiration from distributed systems, perceptual psychology, and the simple desire to watch movies together across distances.