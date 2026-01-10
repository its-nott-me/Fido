import { env } from "../loadEnv.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const r2 = new S3Client({
    region: "auto",
    endpoint: `https://${env.r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: env.r2AccessKeyId,
        secretAccessKey: env.r2SecretAccessKey
    },
    forcePathStyle: true
});

/**
 * Returns a CDN-backed URL for the given media key via the Cloudflare Worker proxy.
 */
export async function getMediaUrl(key) {
    if (!env.r2WorkerUrl) {
        throw new Error("R2_WORKER_URL is not defined in environment");
    }

    const baseUrl = env.r2WorkerUrl.endsWith('/')
        ? env.r2WorkerUrl.slice(0, -1)
        : env.r2WorkerUrl;

    return `${baseUrl}/${key}`;
}

/**
 * Uploads a file buffer to R2.
 */
export async function uploadToR2(key, body, contentType) {
    try {
        console.log('uploading')
        const command = new PutObjectCommand({
            Bucket: env.r2BucketName,
            Key: key,
            Body: body,
            ContentType: contentType
        });

        return await r2.send(command);
    } catch (err) {
        console.error(err);
    }
}