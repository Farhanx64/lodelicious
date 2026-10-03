/**
 * One-off: cut the photos out of Lody's mood board (AI-generated) as temporary home-page
 * placeholders (D32). Usage: npx tsx scripts/moodboard-crops.ts <board.jpg>
 * Crop boxes are in the board's own pixels (1242 × 2208).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import sharp from "sharp";

const CROPS: Record<string, [number, number, number, number]> = {
  "hero.jpg": [0, 693, 698, 372],
  "feature-1.jpg": [491, 1079, 205, 178],
  "feature-2.jpg": [711, 1079, 170, 178],
  "feature-3.jpg": [897, 1079, 174, 178],
  "feature-4.jpg": [1088, 1079, 154, 178],
  "strip-1.jpg": [0, 1330, 221, 186],
  "strip-2.jpg": [238, 1330, 283, 186],
  "strip-3.jpg": [537, 1330, 221, 186],
  "strip-4.jpg": [773, 1330, 236, 186],
  "strip-5.jpg": [1024, 1330, 218, 186],
};

const board = process.argv[2];
if (!board) throw new Error("Pass the mood board image path");
const out = path.resolve("data/assets/moodboard");
fs.mkdirSync(out, { recursive: true });
for (const [file, [left, top, width, height]] of Object.entries(CROPS)) {
  await sharp(board).extract({ left, top, width, height }).jpeg({ quality: 90 }).toFile(path.join(out, file));
}
const sha = crypto.createHash("sha256").update(fs.readFileSync(board)).digest("hex");
fs.writeFileSync(
  path.join(out, "SOURCE.md"),
  `# Mood-board placeholders\n\nCropped from Lody's SOUSET-PINK mood board (1242 × 2208, SHA-256 \`${sha}\`) by\n\`scripts/moodboard-crops.ts\`.\n\n**These are AI-generated images, not photos of the shop.** They fill the home-page slots on staging\nonly (seeded with "approved for launch" off, so production hides them) until Lody uploads her own\nphotos in /admin → Home page (D32). Never use them as product photos.\n\n| File | Crop (left, top, width, height) |\n| --- | --- |\n${Object.entries(CROPS)
    .map(([f, c]) => `| ${f} | ${c.join(", ")} |`)
    .join("\n")}\n`,
);
console.log(`wrote ${Object.keys(CROPS).length} crops`);
