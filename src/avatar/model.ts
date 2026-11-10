export const skinColors = [
  "#f6d6bd",
  "#eec29d",
  "#dfaa7d",
  "#cb9468",
  "#b87d51",
  "#99623f",
  "#7b4932",
  "#593624",
];
export const hairColors = [
  "#493026",
  "#251f1c",
  "#79503a",
  "#aa744b",
  "#343e51",
];
export const backdrops = [
  "#e4f3ef",
  "#fff4c8",
  "#e8f1fc",
  "#fbe6e0",
  "#eee8f3",
  "#f1f4f3",
];
export const faceNames = ["วงรี", "กลม", "กรามนุ่ม", "หน้ากว้าง"];
export const hairNames = [
  "สั้นเท็กซ์เจอร์",
  "แสกข้าง",
  "บ๊อบหน้าม้า",
  "ยาวตรง",
  "ลอนแสกกลาง",
  "หยิกสั้น",
  "หางม้า",
  "มวยต่ำ",
];
export const outfitNames = [
  "เชิ้ตนักเรียน",
  "เสื้อนักเรียนผูกโบ",
  "โปโลกีฬา",
  "แจ็กเก็ตวอร์ม",
  "ฮู้ดดี้เหลือง",
  "คาร์ดิแกนเขียว",
  "เสื้อยืดลายขวาง",
  "แจ็กเก็ตยีนส์",
  "สเวตเชิ้ต",
  "ชุดเอี๊ยม",
  "ผ้ากันเปื้อนศิลปะ",
  "เสื้อคลุมฟ้า",
];
export const accessoryNames = [
  "แว่นกลม",
  "แว่นเหลี่ยม",
  "กิ๊บเหลือง",
  "ที่คาดผม",
];
export type Avatar = {
  face: number;
  skin: number;
  hair: number;
  hairColor: number;
  outfit: number;
  accessory: number;
  backdrop: number;
  nickname: string;
  motto: string;
};
export const defaultAvatar: Avatar = {
  face: 0,
  skin: 2,
  hair: 0,
  hairColor: 0,
  outfit: 4,
  accessory: -1,
  backdrop: 0,
  nickname: "",
  motto: "",
};
export function validateAvatar(value: Avatar): Avatar {
  for (const [key, min, max] of [
    ["face", 0, 3],
    ["skin", 0, 7],
    ["hair", -1, 7],
    ["hairColor", 0, 4],
    ["outfit", 0, 11],
    ["accessory", -1, 3],
    ["backdrop", 0, 5],
  ] as const)
    if (!Number.isInteger(value[key]) || value[key] < min || value[key] > max)
      throw Error("ตัวเลือกอวตาร์ไม่ถูกต้อง");
  if (
    typeof value.nickname !== "string" ||
    value.nickname.trim().length > 24 ||
    typeof value.motto !== "string" ||
    value.motto.trim().length > 80
  )
    throw Error("ชื่อเล่นไม่เกิน 24 ตัวอักษร และข้อความไม่เกิน 80 ตัวอักษร");
  return {
    ...value,
    nickname: value.nickname.trim(),
    motto: value.motto.trim(),
  };
}
export const avatarAsset = (kind: string, index: number) =>
  `/avatars/watercolor-v2/${kind}-${index}.webp`;
