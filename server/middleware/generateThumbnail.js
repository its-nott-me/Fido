import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "../r2/cloudflare.js";
import { env } from "../loadEnv.js";
import { PassThrough } from "stream";
import { query } from "../db.js";

ffmpeg.setFfmpegPath(ffmpegPath);

export function extractThumbnailFromUrl(videoUrl) {
  return new Promise((resolve, reject) => {
    const output = new PassThrough();
    const chunks = [];
console.log("Thumbnail source:", videoUrl);

    output.on("data", (chunk) => chunks.push(chunk));
    output.on("end", () => {
      const buffer = Buffer.concat(chunks);

      if (buffer.length === 0) {
        reject(new Error("FFmpeg produced empty thumbnail"));
        return;
      }

      resolve(buffer);
    });
    output.on("error", reject);

    ffmpeg(videoUrl)
      .seekInput("00:00:01")
      .outputOptions([
        "-frames:v 1",
        "-vf scale=640:-1",
        "-q:v 2",
        "-f image2pipe"
      ])
      .on("error", reject)
      .pipe(output, { end: true });
  });
}

export async function generateThumbnail(media) {
  const videoUrl = `${env.r2WorkerUrl}/${media.r2_key}`;
  const thumbKey = media.r2_key.replace(/\.[^/.]+$/, "") + "-thumb.jpg";

  const buffer = await extractThumbnailFromUrl(videoUrl);

  await r2.send(
    new PutObjectCommand({
      Bucket: env.r2BucketName,
      Key: thumbKey,
      Body: buffer,
      ContentType: "image/jpeg",
    })
  );

  await query(
    `
    UPDATE medias
    SET thumbnail_key = $1
    WHERE id = $2
    `,
    [thumbKey, media.id]
  );
}
