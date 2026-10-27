import { handler as createStudent } from '../server/functions/create-student-account.js';
import { handler as claimStudent } from '../server/functions/claim-student-account.js';
import { handler as deleteStudent } from '../server/functions/delete-student-account.js';
import { handler as resetStudent } from '../server/functions/reset-student-password.js';
import { handler as requestReset } from '../server/functions/request-student-password-reset.js';
import { handler as completeReset } from '../server/functions/complete-student-password-reset.js';
import { handler as createGroup } from '../server/functions/create-group-submission.js';
import { handler as cleanup } from '../server/functions/cleanup-submission-files.js';

const handlers = {
  'create-student-account': createStudent,
  'claim-student-account': claimStudent,
  'delete-student-account': deleteStudent,
  'reset-student-password': resetStudent,
  'request-student-password-reset': requestReset,
  'complete-student-password-reset': completeReset,
  'create-group-submission': createGroup,
};

function json(status, error) {
  return Response.json({ error }, { status });
}

export function createWorker(apiHandlers = handlers, cleanupHandler = cleanup) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      // Keep compatibility for already-open browser tabs during the migration.
      const prefix = ['/api/', '/.netlify/functions/'].find(p => url.pathname.startsWith(p));
      if (!prefix) return env.ASSETS.fetch(request);
      const name = url.pathname.slice(prefix.length);
      const handler = Object.hasOwn(apiHandlers, name) ? apiHandlers[name] : undefined;
      if (!handler) return json(404, 'Not found');
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) return json(403, 'Origin not allowed');
      try {
        const result = await handler({
          httpMethod: request.method,
          headers: Object.fromEntries(request.headers),
          body: ['GET', 'HEAD', 'OPTIONS'].includes(request.method) ? '' : await request.text(),
        });
        const headers = new Headers(result.headers);
        headers.delete('Access-Control-Allow-Origin');
        headers.set('Cache-Control', 'no-store');
        headers.set('X-Content-Type-Options', 'nosniff');
        if (origin) headers.set('Access-Control-Allow-Origin', origin);
        const noBody = [204, 205, 304].includes(result.statusCode) || request.method === 'HEAD';
        return new Response(noBody ? null : result.body, { status: result.statusCode, headers });
      } catch {
        return json(500, 'Internal server error');
      }
    },
    async scheduled(_controller, _env, ctx) {
      ctx.waitUntil((async () => {
        const result = await cleanupHandler();
        if (result.statusCode !== 200) throw new Error('Submission file cleanup failed');
      })());
    },
  };
}

export default createWorker();
