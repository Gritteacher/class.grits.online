import { createClient } from "@supabase/supabase-js";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export async function handler() {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return json(500, { error: "Supabase server variables are missing" });

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows, error: queryError } = await admin
    .from("submissions")
    .select("id, file_path")
    .eq("status", "reviewed")
    .not("file_path", "is", null)
    .lt("reviewed_at", cutoff)
    .limit(500);
  if (queryError) return json(500, { error: queryError.message });

  const paths = (rows ?? [])
    .map((row) => row.file_path)
    .filter((path) => typeof path === "string" && path.length > 0);
  if (paths.length) {
    const { error: storageError } = await admin.storage.from("classroom-files").remove(paths);
    if (storageError) return json(500, { error: storageError.message });
  }
  const ids = (rows ?? []).map((row) => row.id);
  if (ids.length) {
    const { error: updateError } = await admin
      .from("submissions")
      .update({ file_path: null, file_name: null, file_type: null, updated_at: new Date().toISOString() })
      .in("id", ids);
    if (updateError) return json(500, { error: updateError.message });
  }
  return json(200, { removed: ids.length, cutoff });
}
