import express from 'express';
import { query } from '../db.js';
import { getMediaUrl, uploadToR2, deleteObjectsByPrefix } from '../r2/cloudflare.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { PassThrough } from "stream";
import fs from 'fs';
import path from 'path';

const router = express.Router();

ffmpeg.setFfmpegPath(ffmpegPath);

export function extractThumbnailFromBuffer(videoBuffer) {
  return new Promise((resolve, reject) => {
    const input = new PassThrough();
    input.end(videoBuffer);

    const output = new PassThrough();
    const chunks = [];

    output.on("data", (chunk) => chunks.push(chunk));
    output.on("end", () => resolve(Buffer.concat(chunks)));
    output.on("error", reject);

    ffmpeg(input)
      .inputFormat("mp4")
      .outputOptions([
        "-frames:v 1",
        "-vf scale=640:-1",
        "-q:v 2"
      ])
      .format("image2")
      .on("error", reject)
      .pipe(output);
  });
}

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

async function uploadHlsDirectory(hlsDir, filename) {
  const files = fs.readdirSync(hlsDir);

  for (const file of files) {
    const filePath = path.join(hlsDir, file);
    const contentType = file.endsWith(".m3u8")
      ? "application/vnd.apple.mpegurl"
      : "video/mp2t";

    await uploadToR2(
      `${file}`,
      fs.createReadStream(filePath),
      contentType
    );
  }

  await uploadToR2(
    `${filename}_thumb.jpg`,
    fs.createReadStream(path.join(hlsDir, `${filename}_thumb.jpg`)),
    "image/jpeg"
  );
}

router.post("/upload", verifyToken, async (req, res) => {
  try {
    const contentType = req.headers["content-type"];
    const contentLength = req.headers['content-length'];

    if (!contentType || !contentType.startsWith("video/")) {
      return res.status(400).json({ error: "Only video uploads allowed" });
    }
    if (contentLength > 1_61_06_12_736) { // >1.5gb
      return res.status(400).json({ error: "Upload size should be less than 1.5GB" });
    }

    const rawFilename =
      req.headers["x-filename"] || `video_${Date.now()}`;

    const filename = rawFilename
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "");

    const { hlsDir } = await convertStreamToHls(req, filename);
    await uploadHlsDirectory(hlsDir, filename);

    const result = await query(
      `
      INSERT INTO medias (user_id, filename, r2_key, thumbnail_key)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [
        req.user.id,
        filename,
        `${filename}_index.m3u8`,
        `${filename}_thumb.jpg`
      ]
    );
    console.log("uploaded vid:", filename);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "HLS processing failed" });
  }
});

export default router;