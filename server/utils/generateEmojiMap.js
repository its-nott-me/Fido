import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL =
    "https://media.githubusercontent.com/media/microsoft/fluentui-emoji-animated/main/assets";

const EMOJI_ROOT = path.join(__dirname, "fluentui-emoji-animated-main\\assets");

const TONES = [
    "Default",
    "Light",
    "Medium-Light",
    "Medium",
    "Medium-Dark",
    "Dark",
];

const toSnakeCase = (str) =>
    str
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "_");

const buildUrl = (folderName, tone, fileName) => {
    const encodedFolder = encodeURIComponent(folderName);

    if (!tone) {
        return `${BASE_URL}/${encodedFolder}/animated/${fileName}`;
    }

    const encodedTone = encodeURIComponent(tone);
    return `${BASE_URL}/${encodedFolder}/${encodedTone}/animated/${fileName}`;
};

const generate = () => {
    const emojiMap = {};

    const emojiFolders = fs.readdirSync(EMOJI_ROOT);

    emojiFolders.forEach((folder) => {
        const folderPath = path.join(EMOJI_ROOT, folder);

        if (!fs.statSync(folderPath).isDirectory()) return;

        const metadataPath = path.join(folderPath, "metadata.json");
        if (!fs.existsSync(metadataPath)) return;

        const metadata = JSON.parse(
            fs.readFileSync(metadataPath, "utf-8")
        );

        const glyph = metadata.glyph;
        if (!glyph) return;

        const fileBase = toSnakeCase(metadata.cldr);

        emojiMap[glyph] = {};

        // Check which tone folders exist in this emoji folder
        const existingToneFolders = TONES.filter((tone) =>
            fs.existsSync(path.join(folderPath, tone))
        );

        if (existingToneFolders.length === 0) {
            // No tone folders → no skin tone support
            const animatedPath = path.join(folderPath, "animated");
            if (!fs.existsSync(animatedPath)) return;

            const fileName = `${fileBase}_animated.png`;
            emojiMap[glyph]["default"] = buildUrl(folder, null, fileName);
            return;
        }

        // Tone folders exist → add each tone
        existingToneFolders.forEach((tone) => {
            const animatedTonePath = path.join(folderPath, tone, "animated");
            if (!fs.existsSync(animatedTonePath)) return;

            const toneFileSuffix =
                tone.toLowerCase().replace("-", "_");

            const fileName =
                tone === "Default"
                    ? `${fileBase}_animated_default.png`
                    : `${fileBase}_animated_${toneFileSuffix}.png`;

            const key =
                tone === "Default" ? "default" : tone.toLowerCase();

            emojiMap[glyph][key] = buildUrl(folder, tone, fileName);
        });
    });

    fs.writeFileSync(
        path.join(__dirname, "emojiMap.json"),
        JSON.stringify(emojiMap, null, 2)
    );

    console.log("✅ emojiMap.json generated correctly with/without skin tones!");
};

generate();
