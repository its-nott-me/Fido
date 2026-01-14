import { env } from '../loadEnv.js';
import express from 'express';
import multer from 'multer';
import { query } from '../db.js';
import { getMediaUrl, uploadToR2 } from '../r2/cloudflare.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { PassThrough } from "stream";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

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

// Upload media
// router.post('/upload', verifyToken, upload.single('media'), async (req, res) => {
//     if (!req.file) {
//         return res.status(400).json({ error: 'No file uploaded' });
//     }

//     const filename = req.file.originalname;
//     const key = `${req.user.id}_${Date.now()}-${filename}`;

//     try {
//         // 1. Upload to R2
//         await uploadToR2(key, req.file.buffer, req.file.mimetype);

//         // 2. Save metadata to DB
//         const result = await query(
//             'INSERT INTO medias (user_id, filename, r2_key) VALUES ($1, $2, $3) RETURNING *',
//             [req.user.id, filename, key]
//         );

//         res.status(201).json(result.rows[0]);
//     } catch (error) {
//         console.error('Upload error:', error);
//         res.status(500).json({ error: 'Failed to upload media' });
//     }
// });


router.post("/upload", verifyToken, upload.single("media"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filename = req.file.originalname;
    const timestamp = Date.now();
    const mediaKey = `${req.user.id}_${timestamp}-${filename}`;
    const thumbKey = `${req.user.id}_${timestamp}-thumb.jpg`;

    try {
      let thumbnailKey = null;

      if (req.file.mimetype === "video/mp4") {
        const thumbnailBuffer = await extractThumbnailFromBuffer(
          req.file.buffer
        );

        await uploadToR2(
          thumbKey,
          thumbnailBuffer,
          "image/jpeg"
        );

        thumbnailKey = thumbKey;
      }

      await uploadToR2(
        mediaKey,
        req.file.buffer,
        req.file.mimetype
      );

      const result = await query(
        `
        INSERT INTO medias (user_id, filename, r2_key, thumbnail_key)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [req.user.id, filename, mediaKey, thumbnailKey]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to upload media" });
    }
  }
);


export default router;