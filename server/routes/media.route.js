import express from 'express';
import { query } from '../db.js';
import { getMediaUrl, uploadToR2, deleteObjectsByPrefix, getTotalBucketSize } from '../r2/cloudflare.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { PassThrough } from "stream";
import fs from 'fs';
import path from 'path';
import { env } from '../loadEnv.js';

const router = express.Router();

ffmpeg.setFfmpegPath(ffmpegPath);

// List user's media
router.get('/list', verifyToken, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM medias WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List media error:', error);
    res.status(500).json({ error: 'Failed to fetch media collection' });
  }
});

// Get media URL (Public for now, or could be protected)
router.get('/:mediaId', verifyToken, async (req, res) => {
  const mediaId = req.params.mediaId;
  try {
    const mediaUrl = await getMediaUrl(mediaId, req.user.id);
    res.status(200).json({ url: mediaUrl });
    // console.log(mediaUrl, 'key: ', mediaId, req.user.id)
  } catch (error) {
    console.error("Error generating signed URL:", error);
    res.status(500).json({ error: "Failed to generate media URL" });
  }
});

// Delete media
router.delete('/:id', verifyToken, async (req, res) => {
  const mediaId = req.params.id;
  try {
    // 1. Check if media exists and belongs to the user
    const mediaResult = await query(
      'SELECT * FROM medias WHERE id = $1 AND user_id = $2',
      [mediaId, req.user.id]
    );

    if (mediaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Media not found or unauthorized' });
    }

    const media = mediaResult.rows[0];
    const filenamePrefix = media.filename;

    // 2. Delete from R2 (both index/segments and thumbnail)
    // Since all related files start with the filename, we can use the prefix deletion
    await deleteObjectsByPrefix(filenamePrefix);

    // 3. Delete from DB
    await query('DELETE FROM medias WHERE id = $1', [mediaId]);

    res.json({ message: 'Media deleted successfully' });
  } catch (error) {
    console.error('Delete media error:', error);
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

// Upload media
async function optimizeMp4(inputStream, filename, mode = "faststart") {
  const mediaDir = path.join("/tmp", filename);
  fs.mkdirSync(mediaDir, { recursive: true });

  const movflags = mode === "fragmented"
    ? "+frag_keyframe+empty_moov"
    : "+faststart";

  return new Promise((resolve, reject) => {
    ffmpeg(inputStream)
      .outputOptions([
        "-c copy",
        `-movflags ${movflags}`
      ])
      // ===== MP4 output =====
      .output(path.join(mediaDir, `${filename}.mp4`))

      // ===== thumbnail output =====
      .output(path.join(mediaDir, `${filename}_thumb.jpg`))
      .outputOptions([
        "-frames:v 1",
        "-vf scale=640:-1",
        "-q:v 2",
      ])

      .on("start", cmd => console.log("FFmpeg (Optimize):", cmd))
      .on("error", reject)
      .on("end", () => resolve({ mediaDir, outputFilename: `${filename}.mp4` }))
      .run();
  });
}

async function convertStreamToHls(inputStream, filename) {
  const hlsDir = path.join("/tmp", filename);
  fs.mkdirSync(hlsDir, { recursive: true });
  return new Promise((resolve, reject) => {
    ffmpeg(inputStream)
      .videoCodec("libx264")
      .audioCodec("aac")

      // ===== HLS output =====
      .output(path.join(hlsDir, `${filename}_index.m3u8`))
      .outputOptions([
        "-preset veryfast",
        "-hls_time 6",
        "-hls_playlist_type vod",
        "-hls_flags independent_segments",
        "-hls_segment_filename " +
        path.join(hlsDir, `${filename}_seg_%03d.ts`),
      ])

      // ===== thumbnail ouput =====
      .output(path.join(hlsDir, `${filename}_thumb.jpg`))
      .outputOptions([
        "-frames:v 1",
        "-vf scale=640:-1",
        "-q:v 2",
      ])

      .on("start", cmd => console.log("FFmpeg:", cmd))
      .on("error", reject)
      .on("end", () => resolve({ hlsDir }))
      .run();
  });

}

async function uploadMediaDirectory(dir, filename) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    let contentType = "application/octet-stream";

    if (file.endsWith(".m3u8")) {
      contentType = "application/vnd.apple.mpegurl";
    } else if (file.endsWith(".ts")) {
      contentType = "video/mp2t";
    } else if (file.endsWith(".mp4")) {
      contentType = "video/mp4";
    } else if (file.endsWith(".jpg") || file.endsWith(".jpeg")) {
      contentType = "image/jpeg";
    }

    await uploadToR2(
      `${file}`,
      fs.createReadStream(filePath),
      contentType
    );
  }
}

router.post("/upload", verifyToken, async (req, res) => {
  try {
    const contentType = req.headers["content-type"];
    const contentLength = req.headers['content-length'];

    // PRE-CHECK Storage Limit
    const currentSize = await getTotalBucketSize();
    const limit = 9 * 1024 * 1024 * 1024;
    if (currentSize >= limit) {
      return res.status(400).json({ error: "Storage limit reached. Cannot upload more files." });
    }

    if (!contentType || !contentType.startsWith("video/")) {
      return res.status(400).json({ error: "Only video uploads allowed" });
    }
    if (contentLength > 1_61_06_12_736) { // >1.5GB
      return res.status(400).json({ error: "Upload size should be less than 1.5GB" });
    }

    const rawFilename =
      req.headers["x-filename"] || `video_${Date.now()}`;

    const filename = rawFilename
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "");

    // const processMode = req.headers["x-process-mode"] || "hls";
    const processMode = env.processMode;
    let mediaInfo;

    if (processMode === "hls") {
      const { hlsDir } = await convertStreamToHls(req, filename);
      await uploadMediaDirectory(hlsDir, filename);
      mediaInfo = {
        r2_key: `${filename}_index.m3u8`,
        thumbnail_key: `${filename}_thumb.jpg`
      };
    } else {
      const { mediaDir, outputFilename } = await optimizeMp4(req, filename, processMode);
      await uploadMediaDirectory(mediaDir, filename);
      mediaInfo = {
        r2_key: outputFilename,
        thumbnail_key: `${filename}_thumb.jpg`
      };
    }

    const result = await query(
      `
      INSERT INTO medias (user_id, filename, r2_key, thumbnail_key)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [
        req.user.id,
        filename,
        mediaInfo.r2_key,
        mediaInfo.thumbnail_key
      ]
    );
    console.log("uploaded vid:", filename);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Upload error:", err);
    const errorMessage = err.message.includes("Storage limit reached")
      ? err.message
      : "HLS processing failed";
    res.status(err.message.includes("Storage limit reached") ? 400 : 500).json({ error: errorMessage });
  }
});

export default router;