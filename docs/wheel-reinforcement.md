# Classroom Wheel and Reinforcement Points

Implemented phases 1–4 on 2026-11-19. Points are independent of assignment grades.

## Entry Points

- Teacher: More > วงล้อสุ่มนักเรียน.
- Student: compact points balance below the home avatar, or More > แต้มเสริมแรง.
- Classroom UUIDs, not display names, identify rooms throughout the workflow.

## Persistence and Security

- Migration: `supabase/migrations/20261119033941_classroom_wheel_rewards.sql`.
- Applied to Class (`iafertzgtluufjyrnzjh`) through the authenticated SQL Editor.
- Rounds and draws persist in Postgres. Student account registration keeps the
  existing profile UUID, so points awarded before registration remain attached.
- Postgres selects the winner before the animation. Round row locks serialize
  draws, and a stable draw UUID recovers uncertain network responses.
- Immutable positive entries are unique per draw. Reversal entries reference an
  original award, are unique per original, and negate its exact points.
- No client-supplied balance, winner or recipient is accepted by the award API.
- Table writes are revoked from clients. Narrow invoker RPC wrappers call private
  definer functions with explicit identity, teacher-role and classroom checks.
- RLS limits ledger reads to the recipient and the awarding classroom teacher.
- Student deletion cascades through draws/points and removes participant UUIDs.
- Summary totals are computed from the ledger, not cached in client storage.

## User Behavior

- Active students only; optional present/late attendance filter by date and period.
- No-repeat by default; manual participant selection and repeat mode available.
- Starting a new round retains past draws and points.
- Animation lands on the returned winner. Sound is opt-in and reduced-motion
  preferences bypass spinning animation.
- Giving points requires confirmation, a positive integer 1–100 and a reason.
- Errors preserve the award draft; replaying an award cannot double the amount.
- Student balances refresh on entry, foreground/focus and every minute while
  visible. A brief celebration appears once per newly observed positive entry.
- History is paginated and filters dates using Asia/Bangkok day boundaries.

## Verification

- `node --test tests/rewards-model.test.mjs`: participant selection, rotation
  geometry for multiple wheel sizes and point validation.
- `node tests/rewards-database.mjs`: isolated real Postgres engine (PGlite), full
  migration, RLS, direct-write denial, attendance/archived filters, UUID room
  isolation, idempotent operations and deletion cascades.
- `tests/rewards-rls.sql`: passed on production with transaction rollback; no
  production test points, draws or round resets were retained.
- `node tests/rewards-ui.mjs`: 1280/390/320px, actual canvas pixels/motion,
  duplicate room names, no-repeat and reload recovery, lost response retries,
  cancellation, attendance, student history, reduced motion and once-only effects.
- `node tests/no-growth-ui.mjs`: actual shell/menu integration for both roles;
  retired growth functionality remains disabled.
- Existing attendance and material upload UI regressions also pass.

The isolated migration-review page is under `tests/`, not `public/`, and is not
included in the production build. No service-role key is present in the client.
