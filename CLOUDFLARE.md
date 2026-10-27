# Cloudflare hosting

The production frontend and APIs run on Cloudflare Workers at https://class.gritspace.cc. Supabase Auth, PostgreSQL, Storage, RLS policies and existing student identities remain unchanged. LINE/LIFF integration is removed; historical LINE-link tables are retained to avoid deleting production data.

## Development and deployment

- `npm ci`
- Set the existing public `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in a local ignored `.env.local` (and in CI build variables).
- `npm run build`
- `npm run test:worker`
- `npm run dev:worker`
- `npm run deploy`

Store `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` and `RESEND_FROM_EMAIL` as Worker secrets using Wrangler. Never expose service-role or Resend keys through Vite variables or commit them.

`worker/index.js` dispatches `/api/*` to the existing server functions. Old `/.netlify/functions/*` paths remain compatible for already-open browser tabs. Unknown API paths and the removed LINE endpoint return 404. Cleanup is available only through the scheduled handler, never through HTTP.

The production cleanup cron is `0 19 * * *` (02:00 Asia/Bangkok). Disable the old Netlify schedule before enabling this cron to avoid duplicate runs.

The internal student email suffix `students.class.grits.online` is intentionally preserved because it identifies existing Supabase Auth accounts; it is not a web routing dependency. Recovery links use class.gritspace.cc. The Resend sender still uses the existing verified sender/domain; migrate the sender and DNS verification separately before allowing its domain to expire.

A previous Netlify deploy can be restored and the DNS CNAME pointed back to kruthai-social-classroom.netlify.app if a rollback is required. Do not delete the old Netlify project or Supabase resources during cutover.
