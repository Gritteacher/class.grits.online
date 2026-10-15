export const LIFF_ID = "2012019762-QjgazsLZ";

type LiffClient = typeof import("@line/liff").default;
let client: LiffClient | null = null;

export function isLineEntry(): boolean {
  const params = new URLSearchParams(window.location.search);
  return window.location.hostname === "class.grits.online" &&
    (/Line\//i.test(navigator.userAgent) ||
      [...params.keys()].some((key) => key.startsWith("liff.")));
}

export async function initializeLineEntry(): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      import("@line/liff").then(async ({ default: liff }) => {
        client = liff;
        await liff.init({ liffId: LIFF_ID, withLoginOnExternalBrowser: false });
        if (!liff.isLoggedIn()) liff.login({ redirectUri: window.location.href });
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("LINE initialization timeout")), 12000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function isLineAuthenticated() {
  return Boolean(client?.isLoggedIn());
}

export function getLineIdToken() {
  const token = client?.getIDToken();
  if (!token) throw new Error("กรุณาเข้าสู่ระบบ LINE ก่อน");
  return token;
}
