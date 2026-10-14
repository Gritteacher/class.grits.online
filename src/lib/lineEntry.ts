export const LIFF_ID = "2012019762-QjgazsLZ";

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
      import("@line/liff").then(({ default: liff }) =>
        liff.init({ liffId: LIFF_ID, withLoginOnExternalBrowser: false })),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("LINE initialization timeout")), 12000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
