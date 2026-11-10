import {
  avatarAsset,
  backdrops,
  hairColors,
  skinColors,
  type Avatar,
} from "./model";
const images = new Map<string, Promise<HTMLImageElement>>();
function load(url: string) {
  if (!images.has(url))
    images.set(
      url,
      new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => {
          images.delete(url);
          reject(Error("โหลดภาพอวตาร์ไม่สำเร็จ"));
        };
        image.src = url;
      }),
    );
  return images.get(url)!;
}
const tinted = new Map<string, HTMLCanvasElement>();
function tint(image: HTMLImageElement, color: string, skin = false) {
  const key = `${image.src}:${color}:${skin}`;
  if (tinted.has(key)) return tinted.get(key)!;
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  for (let i = 0; i < pixels.data.length; i += 4) {
    const r = pixels.data[i],
      g = pixels.data[i + 1],
      b = pixels.data[i + 2];
    if (!pixels.data[i + 3]) continue;
    if (skin && !(r > g * 1.06 && g > b * 1.04 && r > 65)) continue;
    const light = (r * 0.3 + g * 0.59 + b * 0.11) / (skin ? 182 : 88);
    for (let c = 0; c < 3; c++)
      pixels.data[i + c] = Math.max(0, Math.min(255, rgb[c] * light));
  }
  ctx.putImageData(pixels, 0, 0);
  if(tinted.size >= 16) tinted.delete(tinted.keys().next().value!);
  tinted.set(key, canvas);
  return canvas;
}
export async function renderAvatar(
  canvas: HTMLCanvasElement,
  value: Avatar,
  isCurrent: () => boolean = () => true,
) {
  const [face, outfit, hair, accessory] = await Promise.all([
    load(avatarAsset("face", value.face)),
    load(avatarAsset("outfit", value.outfit)),
    value.hair < 0 ? null : load(avatarAsset("hair", value.hair)),
    value.accessory < 0
      ? null
      : load(avatarAsset("accessory", value.accessory)),
  ]);
  if (!isCurrent()) return;
  canvas.width = 512;
  canvas.height = 640;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 512, 640);
  ctx.fillStyle = backdrops[value.backdrop];
  ctx.fillRect(0, 0, 512, 640);
  const faceImage = tint(face, skinColors[value.skin], true);
  // Extend the neck behind open collars; the face and clothing hide both ends.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(198, 340);
  ctx.lineTo(314, 340);
  ctx.lineTo(340, 366);
  ctx.lineTo(334, 480);
  ctx.lineTo(178, 480);
  ctx.lineTo(172, 366);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(
    faceImage,
    faceImage.width * 0.30,
    faceImage.height * 0.985,
    faceImage.width * 0.40,
    faceImage.height * 0.008,
    172,
    340,
    168,
    140,
  );
  ctx.restore();
  ctx.drawImage(faceImage, 126, 48, 260, 350);
  const collarY = [334, 334, 340, 340, 340, 342, 344, 340, 344, 334, 340, 340];
  ctx.drawImage(outfit, 22, collarY[value.outfit], 468, 390);
  if (hair) {
    const widths = [285, 300, 318, 330, 330, 305, 350, 320];
    const heights = [190, 198, 350, 400, 380, 230, 390, 330];
    const w = widths[value.hair];
    ctx.drawImage(
      tint(hair, hairColors[value.hairColor]),
      256 - w / 2,
      24,
      w,
      heights[value.hair],
    );
  }
  if (accessory) {
    if (value.accessory < 2)
      ctx.drawImage(accessory, 150, value.accessory === 0 ? 162 : 170, 212, value.accessory === 0 ? 86 : 70);
    else if (value.accessory === 2) ctx.drawImage(accessory, 320, 104, 60, 42);
    else ctx.drawImage(accessory, 116, 30, 280, 230);
  }
}
