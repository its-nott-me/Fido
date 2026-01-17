import cron from 'node-cron';
import { query } from '../db.js';
import { deleteObjectsByPrefix } from '../r2/cloudflare.js';

/**
 * Cleanup task: Deletes media older than 7 days.
 */
export async function performCleanup() {
    console.log('--- Starting scheduled media cleanup ---');
    try {
        // identify media records older than 7 days
        const result = await query(
            "SELECT id, filename FROM medias WHERE created_at < NOW() - INTERVAL '7 days'"
        );

        const oldMedias = result.rows;
        console.log(`Found ${oldMedias.length} expired media records.`);

        for (const media of oldMedias) {
            try {
                console.log(`Purging media: ${media.filename} (ID: ${media.id})`);

                // Delete from R2 (HLS segments, index, and thumbnail)
                await deleteObjectsByPrefix(media.filename);

                // delete from Database
                await query('DELETE FROM medias WHERE id = $1', [media.id]);

                console.log(`Successfully purged ${media.filename}`);
            } catch (err) {
                console.error(`Failed to purge media ${media.filename}:`, err);
            }
        }

        console.log('=== Media cleanup completed ===');
    } catch (error) {
        console.error('Error during scheduled cleanup:', error);
    }
}

/**
 * Initializes the cleanup scheduler.
 * Runs every day at midnight
 */
export function initCleanupScheduler() {
    // Cron schedule: minute hour day-of-month month day-of-week
    // '0 0 * * *'
    cron.schedule('0 0 * * *', () => {
        performCleanup();
    });

    console.log('Media cleanup scheduler initialized (Running daily at midnight)');

    // run once on startup
    // performCleanup();
}
