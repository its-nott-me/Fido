import { env } from "../loadEnv.js";
import { S3Client, PutObjectCommand, DeleteObjectsCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";

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
export async function getMediaUrl(key, userId) {
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

/**
 * Deletes a single object from R2.
 */
export async function deleteObjectFromR2(key) {
    try {
        const command = new DeleteObjectCommand({
            Bucket: env.r2BucketName,
            Key: key,
        });
        return await r2.send(command);
    } catch (err) {
        console.error(`Error deleting object ${key}:`, err);
        throw err;
    }
}

/**
 * Deletes all objects in R2 that start with a specific prefix.
 * Useful for HLS videos where multiple files share a filename prefix.
 */
export async function deleteObjectsByPrefix(prefix) {
    try {
        // 1. List all objects with the prefix
        const listCommand = new ListObjectsV2Command({
            Bucket: env.r2BucketName,
            Prefix: prefix,
        });
        const listResponse = await r2.send(listCommand);

        if (!listResponse.Contents || listResponse.Contents.length === 0) {
            return;
        }

        // 2. Prepare for batch deletion
        const objectsToDelete = listResponse.Contents.map((obj) => ({ Key: obj.Key }));

        const deleteCommand = new DeleteObjectsCommand({
            Bucket: env.r2BucketName,
            Delete: {
                Objects: objectsToDelete,
            },
        });

        return await r2.send(deleteCommand);
    } catch (err) {
        console.error(`Error deleting objects with prefix ${prefix}:`, err);
        throw err;
    }
}