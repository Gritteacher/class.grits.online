import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { SourceTextModule, SyntheticModule } from "node:vm";

let responses = [];
let updates = [];
let filters = [];
const client = {
  from(table) {
    const expected = responses.shift();
    assert.equal(table, expected.table);
    const chain = new Proxy({}, {
      get(_target, key) {
        if (key === "then") return (resolve) => resolve(expected.result);
        return (...args) => {
          if (key === "update") updates.push(args[0]);
          if (key === "eq") filters.push([table, ...args]);
          if (key === "eq" && args[0] === "teacher_id") assert.equal(args[1], "teacher");
          return chain;
        };
      },
    });
    return chain;
  },
};
const dependency = new SyntheticModule(["supabase"], function () {
  this.setExport("supabase", client);
});
const source = await readFile(new URL("../src/services/classroomService.ts", import.meta.url), "utf8");
const module = new SourceTextModule(stripTypeScriptTypes(source));
await module.link(() => dependency);
await module.evaluate();
const { getTeacherClassroomId, removeClassroomFromSupabase, applyTeacherRoster, renameClassroomInSupabase } = module.namespace;
const rooms = [
  { id: "r1", name: "ม.6/1", room: "1" },
  { id: "r2", name: "ม.5/1", room: "1" },
];
const lookup = () => ({ table: "classrooms", result: { data: rooms, error: null } });
responses = [lookup()];
assert.equal(await getTeacherClassroomId("teacher", "ม.6/1"), "r1");
responses = [lookup()];
await assert.rejects(getTeacherClassroomId("teacher", "1"), /ซ้ำ/);
const state = applyTeacherRoster({}, { classrooms: rooms, students: [] });
assert.deepEqual(state.rooms, ["ม.6/1", "ม.5/1"]);
const duplicates = [{ id: "r1", name: "ม.6/1", room: "1" }, { id: "r2", name: "ม.6/1", room: "1" }];
responses = [{ table: "classrooms", result: { data: duplicates, error: null } }];
assert.equal(await getTeacherClassroomId("teacher", "ม.6/1", "r2"), "r2");
responses = [lookup()];
await assert.rejects(getTeacherClassroomId("teacher", "ม.6/1", "foreign-room"), /ไม่มีสิทธิ์/);
filters = [];
responses = [{ table: "classrooms", result: { data: duplicates, error: null } }, ...[
  "classroom_members", "assignment_classrooms", "material_classrooms", "announcements",
].map((table) => ({ table, result: { count: 0, error: null } })),
{ table: "classrooms", result: { data: { id: "r2" }, error: null } }];
await removeClassroomFromSupabase("teacher", "ม.6/1", "r2");
assert.deepEqual(filters.filter(([, key]) => key === "classroom_id").map(([, , id]) => id), ["r2", "r2", "r2", "r2"]);
assert.ok(filters.some(([table, key, value]) => table === "classrooms" && key === "id" && value === "r2"));
assert.ok(!filters.some(([, key, value]) => key === "id" && value === "r1"));
responses = [{ table: "classrooms", result: { data: duplicates, error: null } },
{ table: "classroom_members", result: { count: 1, error: null } }];
await assert.rejects(removeClassroomFromSupabase("teacher", "ม.6/1", "r1"), /ยังมีรายชื่อ/);
assert.equal(responses.length, 0);
for (const deleted of [null, { id: "r1" }]) {
  responses = [lookup(), ...[
    "classroom_members", "assignment_classrooms", "material_classrooms", "announcements",
  ].map((table) => ({ table, result: { count: 0, error: null } })),
  { table: "classrooms", result: { data: deleted, error: null } }];
  if (deleted) await removeClassroomFromSupabase("teacher", "ม.6/1");
  else await assert.rejects(removeClassroomFromSupabase("teacher", "ม.6/1"), /สิทธิ์การลบ/);
  assert.equal(responses.length, 0);
}
for (const scenario of ["saved", "duplicate", "denied"]) {
  updates = [];
  responses = [lookup(), { table: "classrooms", result: {
    data: scenario === "duplicate" ? [{ id: "r2" }] : [], error: null,
  } }];
  if (scenario !== "duplicate") responses.push({ table: "classrooms", result: {
    data: scenario === "saved" ? { id: "r1", name: "ห้องใหม่" } : null, error: null,
  } });
  const operation = renameClassroomInSupabase("teacher", "ม.6/1", "  ห้องใหม่  ");
  if (scenario === "saved") await operation;
  else await assert.rejects(operation, scenario === "duplicate" ? /มีชื่อห้องเรียนนี้แล้ว/ : /บันทึกชื่อห้องไม่สำเร็จ/);
  assert.deepEqual(updates, scenario === "duplicate" ? [] : [{ name: "ห้องใหม่" }]);
  assert.equal(responses.length, 0);
}
const rosterSource = await readFile(new URL("../src/roster/model.ts", import.meta.url), "utf8");
const rosterModule = new SourceTextModule(stripTypeScriptTypes(rosterSource));
const stubs = new SyntheticModule(["defaultAvatar", "gradeEntries"], function () {
  this.setExport("defaultAvatar", () => ({}));
  this.setExport("gradeEntries", () => []);
});
await rosterModule.link(() => stubs);
await rosterModule.evaluate();
const original = {
  rooms: ["ม.6/1", "ม.5/1"], roomSubjects: { "ม.6/1": "ประวัติศาสตร์" },
  students: [{ id: "s1", room: "ม.6/1" }, { id: "s2", room: "ม.5/1" }],
  assignments: [{ id: "a1", rooms: ["ม.6/1", "ม.5/1"] }],
  materials: [{ id: "m1", rooms: ["ม.6/1"] }],
  announcements: [{ id: "n1", room: "ม.6/1" }],
  downloadLogs: [{ room: "ม.6/1" }], grades: [{ id: "g1" }], submissions: [{ id: "sub1" }],
};
const renamed = rosterModule.namespace.renameRoom(original, "ม.6/1", "ห้องใหม่");
assert.equal(renamed.students[0].room, "ห้องใหม่");
assert.equal(renamed.students[1].room, "ม.5/1");
assert.deepEqual(renamed.assignments[0].rooms, ["ห้องใหม่", "ม.5/1"]);
assert.deepEqual(renamed.materials[0].rooms, ["ห้องใหม่"]);
assert.equal(renamed.announcements[0].room, "ห้องใหม่");
assert.equal(renamed.downloadLogs[0].room, "ห้องใหม่");
assert.equal(renamed.roomSubjects["ห้องใหม่"], "ประวัติศาสตร์");
assert.equal(renamed.grades, original.grades);
assert.equal(renamed.submissions, original.submissions);
assert.equal(original.students[0].room, "ม.6/1");
assert.throws(() => rosterModule.namespace.renameRoom(original, "ม.6/1", "ม.5/1"), /มีชื่อห้องเรียนนี้แล้ว/);
console.log("Passed: room lookup, verified deletion, rename success/duplicate/denied, linked data preservation.");
