-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Medias Table (for Gallery)
CREATE TABLE IF NOT EXISTS medias (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  filename TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sessions Table (for Persistence)
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(50) PRIMARY KEY,
  host_id INTEGER REFERENCES users(id),
  r2_key TEXT, -- The video currently playing
  password VARCHAR(100), -- Optional
  last_state JSONB, -- Stored sync snapshot {playing, position, timestamp}
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
