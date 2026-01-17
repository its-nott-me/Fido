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

const STORAGE_LIMIT_BYTES = 9 * 1024 * 1024 * 1024; // 9GB

/**
 * Calculate the total size of all objects in the R2 bucket.
 */
export async function getTotalBucketSize() {
    try {
        let totalSize = 0;
        let isTruncated = true;
        let continuationToken = undefined;

        while (isTruncated) {
            const command = new ListObjectsV2Command({
                Bucket: env.r2BucketName,
                ContinuationToken: continuationToken,
            });

            const response = await r2.send(command);
            if (response.Contents) {
                totalSize += response.Contents.reduce((sum, obj) => sum + (obj.Size || 0), 0);
            }

            isTruncated = response.IsTruncated;
            continuationToken = response.NextContinuationToken;
        }

        return totalSize;
    } catch (err) {
        console.error("Error calculating bucket size:", err);
        return 0; // Fallback to 0 if list fails
    }
}

/**
 * Uploads a file buffer to R2.
 */
export async function uploadToR2(key, body, contentType) {
    try {
        // Enforce storage guard
        const currentSize = await getTotalBucketSize();
        if (currentSize >= STORAGE_LIMIT_BYTES) {
            console.error(`Upload rejected: Storage limit reached (${(currentSize / 1024 / 1024 / 1024).toFixed(2)} GB / 9 GB)`);
            throw new Error("Storage limit reached. Cannot upload more files.");
        }

        const command = new PutObjectCommand({
            Bucket: env.r2BucketName,
            Key: key,
            Body: body,
            ContentType: contentType
        });

        return await r2.send(command);
    } catch (err) {
        console.error("error in uploadToR2: ", err.message);
        throw err;
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