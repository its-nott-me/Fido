import pg from 'pg';
import { env } from './loadEnv.js';

const { Pool } = pg;

// If DATABASE_URL is not provided, we won't be able to connect
if (!env.databaseUrl) {
    console.warn('WARNING: DATABASE_URL not set in environment. Database operations will fail.');
}

const pool = new Pool({
    connectionString: env.databaseUrl,
    ssl: env.databaseUrl?.includes('localhost') ? false : { rejectUnauthorized: false }
});

export const query = (text, params) => pool.query(text, params);
export default pool;
