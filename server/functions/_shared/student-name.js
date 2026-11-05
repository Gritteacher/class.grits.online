function normalize(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/gu, "")
    .trim()
    .toLowerCase();
}

const compact = value => value.replace(/[\s.]+/gu, "");
const prefix = /^(?:นางสาว|เด็กหญิง|เด็กชาย|นาย|นาง|น\s*\.\s*ส\s*\.?|ด\s*\.\s*ช\s*\.?|ด\s*\.\s*ญ\s*\.?)(?:\s*)/u;

export function studentNameMatches(displayName, firstName, lastName) {
  const stored = normalize(displayName);
  const entered = `${normalize(firstName)} ${normalize(lastName)}`;
  // Keep the original candidate too: a genuine name may begin with a title's letters.
  const candidates = value => [compact(value), compact(value.replace(prefix, ""))];
  return candidates(stored).some(value => value && candidates(entered).includes(value));
}
