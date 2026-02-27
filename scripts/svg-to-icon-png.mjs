/**
 * One-time script: convert app/icon.svg to app/icon.png (512x512).
 * Run: node scripts/svg-to-icon-png.mjs
 * Requires: npm install sharp
 */
import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const svgPath = join(root, "app", "icon.svg");
const outPath = join(root, "app", "icon.png");

const svg = readFileSync(svgPath);
const png = await sharp(svg)
  .resize(512, 512)
  .png()
  .toBuffer();

writeFileSync(outPath, png);
console.log("Written:", outPath);
