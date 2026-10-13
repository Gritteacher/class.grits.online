# New experience: Flip7-inspired classroom

This direction supersedes the navigation and screen structure in the earlier system specification. Business requirements remain reference material, not a requirement to reproduce legacy interactions.

## Three primary journeys

1. Teacher desk: start with pending work, pick an assignment, stay inside its workspace to view submissions, select students, give feedback, and publish mock scores.
2. Assignment workspace: a contextual assignment list next to an inbox with pending, reviewed, and missing states. Class filters live here, not in a global header. Selection reveals grading controls only when needed.
3. Student day: start with the next unsubmitted assignment, then progress and personal work history. A submission immediately changes the teacher's inbox, using the same local mock state.

## Visual language

- Primary teal `#2BA8A2`, gold `#FFD23F`, and coral `#EF6C4A` from the supplied Flip7 document.
- Light neutral surfaces prevent a uniformly teal page. Coral is reserved for announcements and particular task categories; gold highlights the next action.
- Prompt font is bundled locally. School logo is the only brand asset reused.
- Pill actions, rounded repeated task items, dashed separators, and low-opacity colored shadows reference Flip7 without making grading look like a card game.
- Dark mode has a distinct surface/token palette, including dialogs, tables, and forms.
- Navigation uses a floating capsule-shaped glass dock at the bottom on every screen size, with translucent surfaces, subtle borders and theme-aware contrast. Desktop items place icons beside labels; smaller screens stack them. Content and notifications reserve space above the dock, including device safe areas. The assignment list remains horizontally scrollable inside its own boundary.
- Decorative animations, rankings, card-game branding, and continuous glow are intentionally not copied.

## Try the prototype

- Teacher: open an assignment, choose a room, select pending submissions, use full marks or type scores, and save.
- Editing a grouped assignment opens a room selector. Only checked rooms receive the changed fields; each room keeps independent deadlines, score scales, submissions, grades and edit history.
- Student: switch the preview role at the top, see the same score, submit the remaining task, then switch back to review it.
- Create a task for only room 3; it does not appear for the room 1 sample student.
- Create an exam with score-only mode, then record scores from the progress table. Students see the grade without a request to upload homework. A manual grade and review grade share one current ledger, with confirmation before review overwrites a manual entry.
- Change themes and resize the window. Reset sample data only after confirming the dialog.

## Boundaries

All records are fictional and persisted only in the current browser. The role switch is a prototype control, not authentication. No current workflow claims database transactions, account security, realtime, group support, PDF editing, or deployment. Those require a separately approved integration stage.
