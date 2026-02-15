import React from "react";
import emojiRegex from "emoji-regex";
import emojiMap from "./emojiMap.json";

const SKIN_TONE_MAP: Record<string, string> = {
    "🏻": "light",
    "🏼": "medium-light",
    "🏽": "medium",
    "🏾": "medium-dark",
    "🏿": "dark",
};

interface EmojiTones {
    [tone: string]: string;
}

export const TextWithEmoji = ({ text }: { text: string }) => {
    const regex = emojiRegex();
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    for (const match of text.matchAll(regex)) {
        const index = match.index ?? 0;
        const emojiChar = match[0];

        elements.push(text.slice(lastIndex, index));

        const toneMatch = emojiChar.match(/[\u{1F3FB}-\u{1F3FF}]/u);
        const toneKey = toneMatch ? SKIN_TONE_MAP[toneMatch[0]] : "default";

        const baseEmoji = emojiChar.replace(/[\u{1F3FB}-\u{1F3FF}]/gu, "");

        const emojiData = emojiMap[baseEmoji as keyof typeof emojiMap] as EmojiTones;

        if (emojiData) {
            const src = emojiData[toneKey] || emojiData["default"];

            elements.push(
                <img
                    key={index}
                    src={src}
                    alt={emojiData["default"] ? baseEmoji : ""}
                    width={28}
                    style={{ display: "inline-block", verticalAlign: "middle" }}
                />
            );
        } else {
            elements.push(emojiChar);
        }

        lastIndex = index + emojiChar.length;
    }

    elements.push(text.slice(lastIndex));

    return <span>{elements}</span>;
};
