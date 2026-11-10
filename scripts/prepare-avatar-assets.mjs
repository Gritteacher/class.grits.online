import sharp from "sharp";
import { mkdir, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
const source = process.argv[2];
if (!source) throw Error("Pass the generated image directory");
const output = resolve("public/avatars", process.argv[3] || "watercolor-v1");
await mkdir(output, { recursive: true });
const sheets = [
  ["face", "exec-b9aca44f-2296-4382-aada-8e971afad67e.png", 2, 2],
  ["hair", "exec-add9c3d7-b722-4ad2-a2b0-f4394808c0c6.png", 4, 2],
  ["outfit", "exec-8caad46e-feea-4a16-9afe-4399e0098d8c.png", 4, 3],
  ["accessory", "exec-08898983-0b63-4b8a-86c6-e3bdc16b464c.png", 2, 2],
];
for (const [kind, file, cols, rows] of sheets) {
  const path = resolve(source, file),
    meta = await sharp(path).metadata();
  for (let index = 0; index < cols * rows; index++) {
    const x = index % cols,
      y = Math.floor(index / cols);
    const left = Math.round((x * meta.width) / cols),
      top = Math.round((y * meta.height) / rows);
    const width = Math.round(((x + 1) * meta.width) / cols) - left,
      height = Math.round(((y + 1) * meta.height) / rows) - top;
    const { data, info } = await sharp(path)
      .extract({ left, top, width, height })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    // Atlas cells can contain disconnected brushwork from the neighboring outfit.
    if (kind === "outfit") {
      const seen = new Uint8Array(width * height);
      const queue = new Uint32Array(width * height);
      let largest = [];
      for (let p = 0; p < width * height; p++) {
        if (seen[p] || data[p * 4 + 3] < 16) continue;
        let head = 0, tail = 1;
        queue[0] = p;
        seen[p] = 1;
        while (head < tail) {
          const current = queue[head++];
          const cx = current % width, cy = Math.floor(current / width);
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const next = ny * width + nx;
            if (!seen[next] && data[next * 4 + 3] >= 16) {
              seen[next] = 1;
              queue[tail++] = next;
            }
          }
        }
        if (tail > largest.length) largest = Array.from(queue.subarray(0, tail));
      }
      const keep = new Uint8Array(width * height);
      for (const p of largest) keep[p] = 1;
      for (let p = 0; p < width * height; p++) if (!keep[p]) data[p * 4 + 3] = 0;
    }
    let l = width,
      t = height,
      r = 0,
      b = 0;
    for (let py = 0; py < height; py++)
      for (let px = 0; px < width; px++) {
        const a = (py * width + px) * 4 + 3;
        if (data[a] < 16) data[a] = 0;
        if (data[a] > 80) {
          l = Math.min(l, px);
          t = Math.min(t, py);
          r = Math.max(r, px);
          b = Math.max(b, py);
        }
      }
    l = Math.max(0, l - 2);
    t = Math.max(0, t - 2);
    r = Math.min(width - 1, r + 2);
    b = Math.min(height - 1, b + 2);
    await sharp(data, { raw: info })
      .extract({ left: l, top: t, width: r - l + 1, height: b - t + 1 })
      .resize({ width: 480, withoutEnlargement: true })
      .webp({ quality: 88, alphaQuality: 100 })
      .toFile(resolve(output, `${kind}-${index}.webp`));
  }
}
const design = resolve("design/avatar-concepts");
await mkdir(design, { recursive: true });
await copyFile(
  resolve(source, "exec-1978f4d5-513e-4945-9997-be12813eb122.png"),
  resolve(design, "concept-faces.png"),
);
await copyFile(
  resolve(source, "exec-ce488e99-cb60-4507-9e12-4ecc34a200b2.png"),
  resolve(design, "concept-outfits.png"),
);
console.log("Prepared 28 cropped watercolor layers and two reference sheets.");
