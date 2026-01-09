import { Router } from "express";
import { getMediaUrl } from "../r2/cloudflare.js";

const router = Router();

router.get('/:mediaId', async (req, res) => {
    const mediaId = req.params.mediaId;

    try {
        const mediaUrl = await getMediaUrl(mediaId);

        res.status(200).json({
            url: mediaUrl
        });
        console.log(mediaUrl)
    } catch (error) {
        console.error("Error generating signed URL:", error);
        res.status(500).json({ error: "Failed to generate media URL" });
    }
});

export default router;