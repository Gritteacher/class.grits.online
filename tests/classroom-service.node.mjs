import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { SourceTextModule, SyntheticModule } from "node:vm";

let responses = [];
const client = {
  from(table) {
    const expected = responses.shift();
    assert.equal(table, expected.table);
    const chain = new Proxy({}, {
      get(_target, key) {
        if (key === "then") return (resolve) => resolve(expected.result);
        return (...args) => {
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
const { getTeacherClassroomId, removeClassroomFromSupabase, applyTeacherRoster } = module.namespace;
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
for (const deleted of [null, { id: "r1" }]) {
  responses = [lookup(), ...[
    "classroom_members", "assignment_classrooms", "material_classrooms", "announcements",
  ].map((table) => ({ table, result: { count: 0, error: null } })),
  { table: "classrooms", result: { data: deleted, error: null } }];
  if (deleted) await removeClassroomFromSupabase("teacher", "ม.6/1");
  else await assert.rejects(removeClassroomFromSupabase("teacher", "ม.6/1"), /สิทธิ์การลบ/);
  assert.equal(responses.length, 0);
}
console.log("Passed: full room names, ambiguous room rejection, roster labels, verified deletion.");
