import type { State, Student } from "../model";
import { deadline } from "../work/model";

export const axes = [
  {
    id: "completion",
    name: "ทำงานสำเร็จ",
    short: "งานสำเร็จ",
    description:
      "งานที่ส่งแล้ว เทียบกับงานที่ถึงกำหนดในช่วงนี้ รวมงานที่ส่งก่อนกำหนด ไม่หักงานที่ยังไม่ถึงกำหนด",
  },
  {
    id: "punctuality",
    name: "ตรงต่อเวลา",
    short: "ตรงเวลา",
    description:
      "งานที่ส่งภายในวันกำหนด (เวลาประเทศไทย) เทียบกับงานที่ส่งในช่วงนี้",
  },
  {
    id: "participation",
    name: "มีส่วนร่วม",
    short: "มีส่วนร่วม",
    description: "ครูสังเกตการถาม ตอบ และแลกเปลี่ยนความคิดเมื่อได้รับโอกาส",
  },
  {
    id: "persistence",
    name: "พยายามพัฒนา",
    short: "พัฒนา",
    description: "ครูสังเกตการกลับมาแก้ไขงานและนำคำแนะนำไปใช้",
  },
  {
    id: "cooperation",
    name: "ร่วมมือกับผู้อื่น",
    short: "ร่วมมือ",
    description: "ครูสังเกตการทำหน้าที่ รับฟัง และช่วยเหลือในกิจกรรมกลุ่ม",
  },
  {
    id: "reflection",
    name: "ทบทวนการเรียนรู้",
    short: "ทบทวน",
    description: "ครูสังเกตการบอกสิ่งที่ได้เรียนรู้และตั้งเป้าหมายครั้งต่อไป",
  },
] as const;
export type AxisId = (typeof axes)[number]["id"];
export type RubricAxis = Exclude<AxisId, "completion" | "punctuality">;
export type Mood =
  "celebrate" | "confident" | "focused" | "thoughtful" | "neutral";
export const moods: Record<Mood, { name: string; note: string }> = {
  celebrate: {
    name: "ฉลองความสำเร็จ",
    note: "ครบทั้ง 6 ด้าน เฉลี่ยอย่างน้อย 85 และทุกด้านอย่างน้อย 60",
  },
  confident: {
    name: "เติบโตอย่างมั่นใจ",
    note: "อย่างน้อย 3 ด้านที่เปรียบเทียบได้ พัฒนาขึ้นเฉลี่ย 10 จุดขึ้นไป",
  },
  focused: {
    name: "ตั้งใจไปต่อ",
    note: "มีหลักฐานอย่างน้อย 4 ด้าน กำลังเดินหน้าไปยังเป้าหมายถัดไป",
  },
  thoughtful: {
    name: "ค่อย ๆ ลองอีกก้าว",
    note: "มีหลักฐานอย่างน้อย 4 ด้าน และมีด้านต่ำกว่า 40 ที่ครูช่วยสนับสนุนได้",
  },
  neutral: {
    name: "พร้อมเริ่มต้น",
    note: "ยังมีหลักฐานครบเกณฑ์น้อยกว่า 4 ด้าน",
  },
};
export type Appearance = {
  skin: string;
  hair: "short" | "bob" | "curly";
  shirt: string;
  backdrop: string;
  accessory: "none" | "glasses" | "star";
  automatic: boolean;
};
export const skins = ["#f3c9a6", "#dba879", "#b87c55", "#815338"];
export const shirts = ["#2ba8a2", "#ffd23f", "#ef6c4a", "#5dade2"];
export const backdrops = ["#e8f6f5", "#fff7d7", "#fff0e9", "#e9f3fc"];
export type GrowthEvent = {
  id: string;
  studentId: string;
  kind: "award" | "deduct" | "reverse";
  delta: number;
  reason: string;
  actor: string;
  at: string;
  reversalOf?: string;
};
export type Observation = {
  id: string;
  studentId: string;
  axis: RubricAxis;
  rating: number;
  note: string;
  actor: string;
  at: string;
};
export type GrowthState = {
  version: 1;
  events: GrowthEvent[];
  observations: Observation[];
  avatars: Record<string, Appearance>;
};
export type Evidence = { label: string; detail: string; at: string };
export type AxisResult = {
  id: AxisId;
  value: number | null;
  count: number;
  required: number;
  explanation: string;
  evidence: Evidence[];
};
const DAY = 86_400_000;
export const defaultAvatar = (index = 0): Appearance => ({
  skin: skins[index % 4],
  hair: (["short", "bob", "curly"] as const)[index % 3],
  shirt: shirts[index % 4],
  backdrop: backdrops[index % 4],
  accessory: "none",
  automatic: true,
});
export function seedGrowth(
  studentIds: string[],
  now = Date.now(),
): GrowthState {
  const events: GrowthEvent[] = [];
  const observations: Observation[] = [];
  studentIds.forEach((id, index) => {
    if (index === studentIds.length - 1) return;
    [15, 10, 20].forEach((delta, n) =>
      events.push({
        id: `seed-${id}-${n}`,
        studentId: id,
        kind: "award",
        delta,
        reason: [
          "ช่วยเพื่อนอธิบายแนวคิดในกิจกรรม",
          "ตั้งใจปรับงานตามคำแนะนำ",
          "แบ่งหน้าที่และรับฟังสมาชิกในกลุ่ม",
        ][n],
        actor: "ครูไต๋",
        at: new Date(now - (7 - n) * DAY).toISOString(),
      }),
    );
    (
      ["participation", "persistence", "cooperation", "reflection"] as const
    ).forEach((axis, a) => {
      [0, 1, 2].forEach((n) => {
        observations.push({
          id: `obs-${id}-${a}-${n}`,
          studentId: id,
          axis,
          rating: Math.max(
            0,
            Math.min(4, [3, 3, 4, 2][a] + (n === 2 ? 1 : 0) - (index % 2)),
          ),
          note: [
            "แลกเปลี่ยนความคิดเห็นพร้อมยกตัวอย่าง",
            "แก้ไขคำอธิบายหลังได้รับคำแนะนำ",
            "รับฟังเพื่อนและทำส่วนที่รับผิดชอบ",
            "บอกสิ่งที่เรียนรู้และสิ่งที่จะลองครั้งหน้า",
          ][a],
          actor: "ครูไต๋",
          at: new Date(now - (8 - n) * DAY).toISOString(),
        });
        observations.push({
          id: `prior-${id}-${a}-${n}`,
          studentId: id,
          axis,
          rating: [2, 2, 3, 1][a],
          note: "บันทึกตัวอย่างช่วงก่อนหน้า",
          actor: "ครูไต๋",
          at: new Date(now - (38 - n) * DAY).toISOString(),
        });
      });
    });
  });
  return {
    version: 1,
    events,
    observations,
    avatars: Object.fromEntries(
      studentIds.map((id, i) => [id, defaultAvatar(i)]),
    ),
  };
}
export function wallet(growth: GrowthState, studentId: string) {
  const events = growth.events.filter((e) => e.studentId === studentId);
  const reversed = new Set(
    events.filter((e) => e.kind === "reverse").map((e) => e.reversalOf),
  );
  const balance = events.reduce((sum, e) => sum + e.delta, 0);
  const xp = events
    .filter((e) => e.kind === "award" && !reversed.has(e.id))
    .reduce((sum, e) => sum + e.delta, 0);
  return {
    balance,
    xp,
    level: 1 + Math.floor(xp / 50),
    remaining: 50 - (xp % 50),
    progress: ((xp % 50) / 50) * 100,
  };
}
export function addPoints(
  growth: GrowthState,
  studentId: string,
  kind: "award" | "deduct",
  amount: number,
  reason: string,
): GrowthState {
  if (!growth.avatars[studentId]) throw new Error("ไม่พบนักเรียนที่เลือก");
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100)
    throw new Error("ระบุคะแนนเป็นจำนวนเต็ม 1–100");
  if (!reason.trim() || reason.trim().length > 500)
    throw new Error("ระบุเหตุผลไม่เกิน 500 ตัวอักษร");
  if (kind === "deduct" && wallet(growth, studentId).balance < amount)
    throw new Error("คะแนนไม่เพียงพอ หักจนติดลบไม่ได้");
  return {
    ...growth,
    events: [
      ...growth.events,
      {
        id: crypto.randomUUID(),
        studentId,
        kind,
        delta: kind === "award" ? amount : -amount,
        reason: reason.trim(),
        actor: "ครูไต๋",
        at: new Date().toISOString(),
      },
    ],
  };
}
export function reversePoints(
  growth: GrowthState,
  eventId: string,
  reason: string,
): GrowthState {
  const event = growth.events.find((e) => e.id === eventId);
  if (
    !event ||
    event.kind === "reverse" ||
    growth.events.some((e) => e.reversalOf === eventId)
  )
    throw new Error("รายการนี้ย้อนกลับไม่ได้หรือย้อนกลับไปแล้ว");
  if (!reason.trim() || reason.trim().length > 500)
    throw new Error("ระบุเหตุผลที่แก้ไขไม่เกิน 500 ตัวอักษร");
  if (wallet(growth, event.studentId).balance - event.delta < 0)
    throw new Error(
      "ย้อนรายการนี้แล้วคะแนนจะติดลบ กรุณาตรวจประวัติที่เกี่ยวข้องก่อน",
    );
  return {
    ...growth,
    events: [
      ...growth.events,
      {
        id: crypto.randomUUID(),
        studentId: event.studentId,
        kind: "reverse",
        delta: -event.delta,
        reason: reason.trim(),
        actor: "ครูไต๋",
        at: new Date().toISOString(),
        reversalOf: event.id,
      },
    ],
  };
}
export function addObservation(
  growth: GrowthState,
  studentId: string,
  axis: RubricAxis,
  rating: number,
  note: string,
): GrowthState {
  if (
    !growth.avatars[studentId] ||
    !["participation", "persistence", "cooperation", "reflection"].includes(
      axis,
    )
  )
    throw new Error("เลือกนักเรียนและด้านที่ต้องการบันทึก");
  if (
    !Number.isInteger(rating) ||
    rating < 0 ||
    rating > 4 ||
    !note.trim() ||
    note.trim().length > 500
  )
    throw new Error("เลือกระดับ 0–4 และระบุหลักฐานไม่เกิน 500 ตัวอักษร");
  return {
    ...growth,
    observations: [
      ...growth.observations,
      {
        id: crypto.randomUUID(),
        studentId,
        axis,
        rating,
        note: note.trim(),
        at: new Date().toISOString(),
        actor: "ครูไต๋",
      },
    ],
  };
}
export function saveAvatar(
  growth: GrowthState,
  studentId: string,
  avatar: Appearance,
): GrowthState {
  const level = wallet(growth, studentId).level;
  if (
    !growth.avatars[studentId] ||
    !skins.includes(avatar.skin) ||
    !shirts.includes(avatar.shirt) ||
    !backdrops.includes(avatar.backdrop) ||
    !["short", "bob", "curly"].includes(avatar.hair) ||
    typeof avatar.automatic !== "boolean"
  )
    throw new Error("ตัวเลือกอวตาร์ไม่ถูกต้อง");
  if (
    !["none", "glasses", "star"].includes(avatar.accessory) ||
    (avatar.accessory === "glasses" && level < 2) ||
    (avatar.accessory === "star" && level < 3)
  )
    throw new Error("ระดับยังไม่ถึงสำหรับของตกแต่งนี้");
  return { ...growth, avatars: { ...growth.avatars, [studentId]: avatar } };
}
export function effectiveAvatar(growth: GrowthState, studentId: string) {
  const avatar = growth.avatars[studentId] ?? defaultAvatar();
  const level = wallet(growth, studentId).level;
  return {
    ...avatar,
    accessory:
      (avatar.accessory === "glasses" && level < 2) ||
      (avatar.accessory === "star" && level < 3)
        ? ("none" as const)
        : avatar.accessory,
  };
}
export function radar(
  state: State,
  growth: GrowthState,
  student: Student,
  now = Date.now(),
  previous = false,
): AxisResult[] {
  const end = now - (previous ? 28 * DAY : 0);
  const start = end - 28 * DAY;
  const within = (date: string) => {
    const time = Date.parse(date);
    return time > start && time <= end;
  };
  const assignments = state.assignments.filter(
    (a) => a.rooms.includes(student.room) && a.submissionRequired !== false,
  );
  // Count each assignment once, using the first submission and its original deadline.
  const firstSubmissions = state.submissions.map((s) =>
    [...(s.history ?? []), s].reduce((first, item) =>
      Date.parse(item.submittedAt) < Date.parse(first.submittedAt)
        ? item
        : first,
    ),
  );
  const submissions = firstSubmissions.filter(
    (s) =>
      s.studentId === student.id &&
      assignments.some((a) => a.id === s.assignmentId) &&
      within(s.submittedAt),
  );
  return axes.map((axis) => {
    if (axis.id === "completion") {
      const eligible = assignments.filter(
        (a) =>
          within(deadline(a)) ||
          submissions.some((s) => s.assignmentId === a.id),
      );
      const complete = eligible.filter((a) =>
        firstSubmissions.some(
          (s) =>
            s.studentId === student.id &&
            s.assignmentId === a.id &&
            Date.parse(s.submittedAt) <= end,
        ),
      );
      return {
        id: axis.id,
        value: eligible.length
          ? Math.round((complete.length / eligible.length) * 100)
          : null,
        count: eligible.length,
        required: 1,
        explanation: `ส่งแล้ว ${complete.length} จาก ${eligible.length} งานที่เข้าเกณฑ์`,
        evidence: eligible.map((a) => ({
          label: a.title,
          detail: complete.some((item) => item.id === a.id)
            ? "ส่งแล้ว"
            : "ถึงกำหนดแล้ว ยังไม่ส่ง",
          at: a.due,
        })),
      };
    }
    if (axis.id === "punctuality") {
      const onTime = submissions.filter(
        (s) =>
          Date.parse(s.submittedAt) <=
          Date.parse(
            s.deadlineAt ??
              deadline(assignments.find((a) => a.id === s.assignmentId)!),
          ),
      );
      return {
        id: axis.id,
        value: submissions.length
          ? Math.round((onTime.length / submissions.length) * 100)
          : null,
        count: submissions.length,
        required: 1,
        explanation: `ตรงเวลา ${onTime.length} จาก ${submissions.length} งานที่ส่งในช่วงนี้`,
        evidence: submissions.map((s) => ({
          label: assignments.find((a) => a.id === s.assignmentId)!.title,
          detail: onTime.some((item) => item.id === s.id)
            ? "ส่งทันกำหนด"
            : "ส่งหลังกำหนด",
          at: s.submittedAt,
        })),
      };
    }
    const records = growth.observations.filter(
      (o) => o.studentId === student.id && o.axis === axis.id && within(o.at),
    );
    const value =
      records.length >= 3
        ? Math.round(
            (records.reduce((sum, o) => sum + o.rating, 0) /
              (records.length * 4)) *
              100,
          )
        : null;
    return {
      id: axis.id,
      value,
      count: records.length,
      required: 3,
      explanation:
        value === null
          ? `มี ${records.length} บันทึก ต้องมีอย่างน้อย 3 บันทึก`
          : `เฉลี่ยระดับ ${(records.reduce((sum, o) => sum + o.rating, 0) / records.length).toFixed(2)} / 4 จาก ${records.length} บันทึก`,
      evidence: records.map((o) => ({
        label: o.note,
        detail: `ระดับ ${o.rating}/4 · ${o.actor}`,
        at: o.at,
      })),
    };
  });
}
export function growthMood(
  current: AxisResult[],
  previous: AxisResult[],
): Mood {
  const known = current.filter((a) => a.value !== null);
  if (known.length < 4) return "neutral";
  if (known.some((a) => a.value! < 40)) return "thoughtful";
  if (
    known.length === 6 &&
    known.every((a) => a.value! >= 60) &&
    known.reduce((sum, a) => sum + a.value!, 0) / 6 >= 85
  )
    return "celebrate";
  const comparable = current.filter(
    (a) =>
      a.value !== null && previous.find((p) => p.id === a.id)?.value != null,
  );
  if (
    comparable.length >= 3 &&
    comparable.reduce(
      (sum, a) => sum + a.value! - previous.find((p) => p.id === a.id)!.value!,
      0,
    ) /
      comparable.length >=
      10
  )
    return "confident";
  return "focused";
}

// Legacy prototype saves have no growth data. Upgrade that slice without touching academic work.
export function restoreGrowth(value: unknown, ids: string[]): GrowthState {
  if (!value || typeof value !== "object") return seedGrowth(ids);
  const g = value as GrowthState;
  try {
    if (
      g.version !== 1 ||
      !Array.isArray(g.events) ||
      !Array.isArray(g.observations) ||
      !g.avatars
    )
      return seedGrowth(ids);
    if (
      !g.events.every(
        (e) =>
          ids.includes(e.studentId) &&
          typeof e.id === "string" &&
          ["award", "deduct", "reverse"].includes(e.kind) &&
          Number.isSafeInteger(e.delta) &&
          typeof e.reason === "string" &&
          Number.isFinite(Date.parse(e.at)),
      ) ||
      !g.observations.every(
        (o) =>
          ids.includes(o.studentId) &&
          [
            "participation",
            "persistence",
            "cooperation",
            "reflection",
          ].includes(o.axis) &&
          Number.isInteger(o.rating) &&
          o.rating >= 0 &&
          o.rating <= 4 &&
          typeof o.note === "string" &&
          Number.isFinite(Date.parse(o.at)),
      )
    )
      return seedGrowth(ids);
    const restored = {
      ...g,
      avatars: Object.fromEntries(
        ids.map((id, i) => {
          const a = g.avatars[id];
          return [
            id,
            a &&
            skins.includes(a.skin) &&
            shirts.includes(a.shirt) &&
            backdrops.includes(a.backdrop) &&
            ["short", "bob", "curly"].includes(a.hair) &&
            ["none", "glasses", "star"].includes(a.accessory) &&
            typeof a.automatic === "boolean"
              ? a
              : defaultAvatar(i),
          ];
        }),
      ),
    };
    if (ids.some((id) => wallet(restored, id).balance < 0))
      return seedGrowth(ids);
    return restored;
  } catch {
    return seedGrowth(ids);
  }
}
