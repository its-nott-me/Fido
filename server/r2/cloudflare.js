import { env } from "../loadEnv.js";

/**
 * Returns a CDN-backed URL for the given media key via the Cloudflare Worker proxy.
 * This replaces the need for generating temporary signed URLs and enables edge caching.
 */
export async function getMediaUrl(key) {
    if (!env.r2WorkerUrl) {
        throw new Error("R2_WORKER_URL is not defined in environment");
    }

    // Ensure URL doesn't have double slashes if the worker URL ends with one
    const baseUrl = env.r2WorkerUrl.endsWith('/')
        ? env.r2WorkerUrl.slice(0, -1)
        : env.r2WorkerUrl;

    return `${baseUrl}/${key}`;
}