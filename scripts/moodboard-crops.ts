/**
 * One-off: cut the photos out of Lody's mood board (AI-generated) as temporary home-page
 * placeholders (D32): the flowers, truffles and gift boxes. Usage: npx tsx scripts/moodboard-crops.ts <board.jpg>
 * Crop boxes are in the board's own pixels (1242 × 2208).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import sharp from "sharp";

// Only the flower, truffle and gift-box photos, in the order of the home-page strip (D32).
const CROPS: Record<string, [number, number, number, number]> = {
  "strip-1-hydrangea-vase.jpg": [0, 1330, 221, 186],
  "strip-2-truffles.jpg": [711, 1079, 170, 178],
  "strip-3-pink-bow-box.jpg": [491, 1079, 205, 178],
  "strip-4-hydrangeas.jpg": [1088, 1079, 154, 178],
  "strip-5-blue-ribbon-boxes.jpg": [1024, 1330, 218, 186],
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
