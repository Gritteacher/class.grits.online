# LINE entry setup

- LIFF ID: `2012019762-QjgazsLZ` (public identifier, not a secret).
- LIFF URL: `https://liff.line.me/2012019762-QjgazsLZ`.
- Endpoint: `https://class.grits.online/`, size Full, scope openid.
- Configure the OA rich menu link with the LIFF URL, not the endpoint.
- Keep the channel in development while testing with channel members;
  publish the LINE Login channel before inviting ordinary students.
- Link the intended OA before enabling the add-friend option.

The SDK initializes only on the production domain for LINE browser entries
or LIFF redirect parameters. Ordinary browser visits and local development
do not load the SDK. Initialization precedes classroom app mounting so the
SDK can process its URL credentials first. Errors are not logged with tokens.
After 12 seconds, a retry/external-browser fallback replaces the waiting view.

Classroom authentication remains unchanged. No LINE profile is stored, no
student account is linked, and LINE tokens do not grant classroom permissions.

## Release verification

1. Deploy with the existing production environment variables preserved.
2. Test the LIFF URL on physical Android and iOS devices with LINE installed.
3. Verify consent, classroom login, reload, logout, file upload and download.
4. Verify direct browser login still works and a failed LINE connection offers
   a retry and external-browser link.
5. Publish the channel and configure the rich menu only after these checks.

Local typecheck/build and browser tests do not prove real LINE authentication.
