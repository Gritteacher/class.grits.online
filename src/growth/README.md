# Student growth prototype

This module is local-only. People, rubric observations, and reinforcement events are fictional. Teacher/student switching is a preview, not authentication. There is no AI, emotion detection, camera, remote storage, or deployment.

## Ledger and XP

- Awards and deductions require an integer 1-100 and a nonempty reason (maximum 500 characters).
- Deductions have a separate confirmation step and cannot make the balance negative. They do not reduce XP, levels, or academic grades.
- Corrections append a reversal referencing the original event; the original stays visible. Reversal of a reversal and repeated reversals are rejected. Corrections that would create a negative balance are rejected, not silently clamped.
- XP sums genuine, unreversed positive awards. Reversing a mistaken award removes that award's XP; this is a data correction, not a penalty. Invalidated accessories are hidden until the required level is earned again.
- Every 50 XP earns one level. Glasses unlock at level 2 and the star at level 3. No money, random rewards, spending, or public ranking is implemented.
- Persistence is one local state write. If storage fails, dialogs keep their drafts and no successful state is displayed.

## Six axes

All windows are rolling 28 days, open at the start and closed at the end to avoid duplicate boundary observations. Comparisons use the previous adjacent 28 days. Values are rounded to integers on a 0-100 scale.

1. Completion: assignments with deadlines in the window, plus early submissions in the window. Not-yet-due unsubmitted work is excluded. Submitted count / eligible count.
2. On time: submitted within the assignment's due date, ending 23:59:59.999 Asia/Bangkok / submissions within the window.
3. Participation, 4. Persistence, 5. Cooperation, 6. Reflection: teacher observations scored 0-4 with concrete evidence. At least three observations per axis per window are required. Average rating / 4 * 100.

No evidence is null, never zero. A zero rating means a teacher had an opportunity to observe the behavior but did not observe it, not that the student was absent or incapable. For partial data the radar draws observed points and adjacent known segments only; it does not invent a complete polygon or connect missing axes to zero. Each axis exposes its evidence and calculation. Reinforcement points never drive radar values.

Score-only assignments (such as exams conducted in class) are excluded from the completion and punctuality denominators. Manually entered academic grades do not fabricate submissions or behavioral observations.

This prototype has no attendance/exemption data, historical enrollment changes, or per-student deadline overrides. These must be integrated before the radar can be used for real students. Rubrics and thresholds are prototype rules, not validated psychological measures.

## Five avatar states (precedence order)

1. Fewer than four known axes: neutral.
2. At least one known value below 40: thoughtful/supportive.
3. Six known axes, mean at least 85, all at least 60: celebrate.
4. At least three comparable axes improved by a mean of at least 10 points: confident.
5. Otherwise: focused.

These are symbols of progress, not claims about actual feelings. Students can choose a fixed neutral face. Skin, hair, clothing, and background have no relationship to scoring or identity inference. Teachers cannot customize another person's avatar in the UI. Students only see their own growth view; production permissions must still be implemented server-side before integration.

## Files

- `model.ts`: pure calculation, ledger commands, validation, demo seed, and legacy-save upgrade.
- `Avatar.tsx`: layered SVG character for controllable appearance and expression.
- `Radar.tsx`: six-axis chart, comparison, accessible values, and evidence.
- `Forms.tsx`: awarding, confirming deductions, reversing, observing, and customization.
- `GrowthPage.tsx`: role-aware per-person view; `growth.css`: theme-aware layout.

Tests cover academic isolation, immutability, zero/negative/invalid inputs, reversal guards, locked accessories, five expressions, evidence minima, student controls, cross-role updates, local reload, legacy-save upgrade, and mobile/dark layouts.
