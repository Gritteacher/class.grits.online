# ห้องเรียนสังคมครูไต๋: ต้นแบบประสบการณ์ใหม่

Interactive classroom prototype with a Supabase integration layer. The UI still contains a safe local preview mode, while real teacher authentication, classroom loading, assignments, submissions and score persistence use the configured Supabase project. Do not use the preview mode or sample data for real student records.

## Run

```sh
npm ci
npm run dev -- --port 4317 --strictPort
```

Open http://127.0.0.1:4317/. Node.js 24 is used for this prototype.

## Verify

```sh
npm run typecheck
npm run build
npx playwright install chromium
npm test
```

## Included

- New teacher desk, integrated assignment/review workspace, student home, and score view.
- Teacher/student preview switch, classroom/search filters, pending/reviewed/missing tabs.
- Mock login with teacher/student roles, student-code lookup, classroom-filtered sample picker, in-app student switching, and logout. Each student view, submission, score and avatar uses the selected stable roster ID. Active entries only can enter the student preview; no passwords are requested or stored.
- Create one assignment group for selected rooms. Each room receives its own stable assignment record, while teacher lists keep the records visually grouped.
- Edit one or several rooms from the same dialog, with a room-by-room impact summary, per-student before/after grade previews, stale-edit checks, and explicit confirmation when a grading scale changes. Unselected rooms remain unchanged. Existing raw grades are preserved; scales below an existing raw grade are rejected. Each room retains its own audit snapshot.
- Thai-time opening/deadline controls, optional late acceptance, live student availability and a second deadline check at submission. Existing prototype assignments retain their previous late-accepting behavior until edited.
- Return work with a required correction note and separate resubmission deadline. Students send a new revision, keeping previous files, links, responses and review history. Last published grades stay visible while corrections are pending and are replaced only after a new review.
- Student text, link, and sample PDF/image submission, with teacher preview and shared score totals.
- Local preview persistence, confirm-before-reset, light/dark themes, responsive desktop/tablet/mobile layouts.
- Supabase teacher authentication, teacher roster loading, assignment persistence, student submissions, signed file URLs, review scores and direct score editing.
- Rounded floating glass navigation dock at the bottom on desktop, tablet and mobile, with space reserved for the dock and device safe areas. Existing Flip7 colors and workflows remain intact.
- Independent grade ledger: teachers can record scores without submissions, with required reasons, revision checks, and score history. Review results update the same ledger; replacing a manually entered score requires confirmation.
- Score-only assignments for exams or offline activities. These show student scores without submission controls or missing-homework penalties.
- Local school logo and Prompt font. No CSS or application logic copied from the legacy project.
- Growth menu: separate reinforcement ledger, confirmed deductions, auditable reversals, nondecreasing XP for ordinary deductions, individual six-axis evidence-based radar, 28-day comparisons, and a customizable avatar with five symbolic expressions and level-unlocked accessories.
- Teacher classroom/roster menu: add naturally sorted rooms, add/edit/search students, filtered bulk selection, confirmed archive/restore, and guarded empty-room deletion. Student codes retain leading zeros and are unique even across archived names. New students start with zero reinforcement and no invented observations.
- Excel roster import (`.xls` / `.xlsx`) with destination room, sheet/header selection, automatic or manual column mapping, row preview, explicit exclusions, and a single confirmed local save. Imports create new students and default avatars without overwriting existing students or academic/growth records.

Preview changes are stored only in this browser under `grits.flip7.prototype.v1`. Real authenticated work is stored in Supabase. Local storage is not secure storage and is not a production database.

Existing local saves gain the editable roster and growth slices without replacing academic assignments or submissions. Reset includes roster and growth data. Read `src/growth/README.md` for calculation rules and boundaries.

Roster archival retains the stable student ID, room, submissions, grades, growth history and avatar. Archived students remain visible to teachers in historical score/review/growth views but are excluded from active enrollment, missing-work counts and student login. Restoring a duplicate roll number requires editing that number first. Room moves are blocked once a student has submissions or grades: historical enrollment must be implemented before enabling that migration. Adding a roster entry makes it selectable in mock login but does not create an authentication account. Use fictional data only.

The preview remembers the selected identity in `sessionStorage` (`grits.flip7.preview-session.v1`) so reloads in the same tab retain it. Logout removes this selection, not the classroom data. The role switch and student selector are developer-preview controls, not access control; all mock data still lives in local storage. This is not secure authentication, and student-data protection will require server authentication and RLS before using real students. Storage-restricted browsers can preview in memory without session persistence.

## Current implementation boundary

Materials, announcements, roster import, assignments, submissions, review scores, download history, growth preview, classroom reports, Excel export, and printable PDF reports are implemented. The production cleanup function removes reviewed submission files after seven days while retaining score and submission metadata. Schedule checks still use the device clock; authoritative scheduling and multi-tab concurrency are not implemented.

The following are intentionally out of scope for this version: realtime chat, AI assistant/grading, and online worksheet/PDF writing. Server-backed reward records and full production deployment verification remain follow-up work. Growth events, observations, avatars, and group submissions use the new Supabase migrations when applied.

## Excel roster import

Open **ห้องเรียน → นำเข้า Excel**. Choose a destination room and a workbook. Supported header aliases include `เลขที่`, `เลขประจำตัว` / `รหัสนักเรียน`, `คำนำหน้า`, `ชื่อ`, `สกุล` / `นามสกุล`, or a combined `ชื่อ–สกุล` column. The importer guesses the header within the first 30 rows; teachers can adjust the sheet, header row and columns. Prefix is optional. Room columns in the file are not used: the selected destination room applies to every selected row.

Limits: 5 MB per file, 30 sheets, 1,000 rows including headers and 50 columns per sheet. Blank rows are ignored; rows with missing fields, formulas, cell errors, unsafe numeric precision, duplicate codes or occupied roll numbers are flagged. Existing codes are protected across every room and archived roster. Duplicates within a file are both flagged and must be corrected in the source file. Invalid rows are never silently imported or skipped: exclude them explicitly or fix and reload the workbook. After confirmation, only the checked rows are added. Reimporting the same codes does not create duplicates.

Store student codes as text in Excel, especially leading zeros or codes longer than 15 digits. Zero-padding number formats are preserved when available; zeros already removed by Excel cannot be reconstructed. Password-protected, corrupt, and HTML/CSV files renamed to `.xls` are rejected. Macros are not executed and formula cells are not evaluated or accepted as mapped roster fields.

Parsing runs in a cancellable worker with a 15-second timeout. SheetJS CE 0.20.3 is pinned to its [official distribution](https://docs.sheetjs.com/docs/getting-started/installation/frameworks/); parser/codepage files are bundled locally, not fetched from a CDN during use. Validation reuses the individual-student rules and repeats against the current state immediately before saving. A failed local-storage write retains the preview and leaves the previous roster intact. Workbook bytes are not saved or sent anywhere. This remains a prototype: use fictional student files, not real personal data.

## Assignment lifecycle

`src/work/model.ts` owns assignment editing, Thai timestamps, submission windows, return/resubmit validation and revision snapshots. `src/work/rooms.ts` owns explicit assignment groups and the idempotent upgrade from old multi-room records. The upgrade remaps submissions, grades, grade events and submission history to the correct room record without matching by title. The main `review` command archives the pre-review revision before publishing the next grade. A returned assignment accepts corrections only until the teacher's correction deadline (even if its normal deadline has passed); the teacher can extend that correction deadline from the returned tab. A student cannot overwrite pending or reviewed work without a teacher return. Archival of the student still blocks submission.

The first submission and the deadline in force at that time drive the punctuality axis. Resubmissions do not count as extra assignments or make an originally on-time submission late. The four observation-based axes still require teacher evidence; automatic grading or fabricated behavioral evidence is not introduced. Assignment edits can affect the completion denominator and displayed grade totals, while original due dates and revision records remain available.

## New direction supersedes old UI proposal

The earlier system draft remains a source of business requirements, not a mandate to reuse old screens. The new interface uses the supplied Flip7 design language: teal, gold, coral, tactile controls, restrained colored shadows, and rounded repeated items. At the user's request, navigation now uses a rounded glass dock at the bottom on every screen size. It replaces the desktop sidebar and the mobile second header row. Teachers work from an assignment context, with submissions and grading together; students work from their next task.

Source layout: `model.ts` owns preview contracts/calculation/review validation; `Teacher.tsx` and `Student.tsx` own role-specific views; `ui.tsx` holds common components; `App.tsx` composes navigation and dialogs; `src/services/` owns Supabase reads and writes. Keep preview and real-data paths separate.

## Independent grades

Open **ความก้าวหน้า** as a teacher and use the pencil in a student's assignment cell. The dialog accepts a raw score (including genuine zero), displays the converted score, requires a reason, and saves explicitly. It is not autosave. Blank means no entered score, not zero. Converted points retain the existing per-assignment rounding rule.

`src/grading/model.ts` owns grade entries and append-only local grade events. Student totals and both role views read this ledger, not submission snapshots. Old browser saves without a ledger copy existing non-null submission grades once, including grades on returned work. An existing empty ledger is authoritative and does not re-import old submission scores. Historical submission scores remain review snapshots; their scale is captured separately so subsequent assignment edits do not rewrite past review history.

Reviewing work writes the grade and review status in one local state save. If a manual score already exists, a confirmation lists the proposed replacements. Cancel or failed storage leaves the prior grades and submission states intact. Revision checks guard stale dialogs within the current app instance; they are not multi-tab synchronization or server concurrency control.

Choose **วิธีรับคะแนน → บันทึกคะแนนอย่างเดียว** when creating an offline exam/activity. Such work contributes its configured maximum to student totals but does not accept submissions or affect submission-based radar axes. Assignments with existing submissions cannot be converted to score-only. Scale edits protect existing grades, and room removal is blocked when that room has grades or submissions.

Still pending: academic year/term/course records, server-backed reward records, and production deployment verification. Core authentication, roster, assignment, individual/group submission, score, material, announcement, download-history, and growth paths use Supabase when real login is selected.
## Phase 2: เข้าสู่ระบบจริง

ระบบใช้ Supabase Auth และอ่านสิทธิ์จาก `public.profiles.role` เท่านั้น

1. สร้างผู้ใช้ครูใน Supabase Dashboard ที่ `Authentication > Users > Add user`
2. คัดลอก UUID ของผู้ใช้ครู
3. เปิด `supabase/bootstrap-teacher.sql` แทนค่า `PUT-AUTH-USER-UUID-HERE` แล้วรันใน SQL Editor
4. ตั้งค่าใน `.env.local` หรือ Netlify โดยใช้เฉพาะ `VITE_SUPABASE_URL` และ `VITE_SUPABASE_PUBLISHABLE_KEY`
5. เปิดเว็บแล้วเลือก `ครู` และเข้าสู่ระบบด้วยอีเมล/รหัสผ่านที่สร้างไว้

บัญชีนักเรียนใน Phase 2 ใช้รูปแบบอีเมลภายในจากรหัสนักเรียน แต่การสร้างบัญชีจำนวนมากจะทำใน Phase 3 ผ่านหน้าจัดการรายชื่อของครู

## Phase 3: ห้องเรียนและรายชื่อ

- หน้า `ห้องเรียน` จะโหลดห้องและสมาชิกจาก Supabase เมื่อครูเข้าสู่ระบบจริง
- การเพิ่มห้องใหม่จะบันทึกเข้า `public.classrooms` ผ่าน client ที่มี RLS
- endpoint `/.netlify/functions/create-student-account` เตรียมไว้สำหรับสร้างบัญชีนักเรียน โดยตรวจ bearer token และ `profiles.role = 'teacher'` ฝั่ง server ก่อนเสมอ
- ตั้งค่า `SUPABASE_SERVICE_ROLE_KEY` เฉพาะใน Netlify Functions เท่านั้น ห้ามใช้ใน `VITE_*` หรือ frontend

การนำเข้า XLS ยังตรวจและแสดงตัวอย่างใน browser ได้เหมือนเดิม เมื่อครูเข้าสู่ระบบจริง ระบบจะแสดงช่องรหัสผ่านเริ่มต้นและสร้างบัญชีจากแถวที่เลือกผ่าน Netlify Function แล้วโหลดข้อมูลกลับจาก Supabase อีกครั้ง

ห้ามนำ `SUPABASE_SERVICE_ROLE_KEY` หรือ secret key ใด ๆ ใส่ใน frontend, `.env.example` หรือ commit ลง repository
