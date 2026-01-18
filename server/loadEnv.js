import dotenv from 'dotenv';

dotenv.config();

export const env = {
    // R2 Configuration
    r2AccountId: process.env.R2_ACCOUNT_ID,
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID,
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    r2BucketName: process.env.R2_BUCKET_NAME,
    r2WorkerUrl: process.env.R2_WORKER_URL,
    databaseUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    // Server Configuration
    port: process.env.PORT || 3001,
    frontendURL: process.env.FRONTEND_URL,
};
