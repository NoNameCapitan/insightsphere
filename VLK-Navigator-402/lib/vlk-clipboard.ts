/** A denied or unavailable clipboard opens a manual copy path in the UI. */
export async function copyPlainText(text: string, clipboard?: Pick<Clipboard, "writeText"> | null): Promise<boolean> {
  try {
    const target = clipboard === undefined
      ? (typeof navigator === "undefined" ? undefined : navigator.clipboard)
      : clipboard;
    if (!target) return false;
    await target.writeText(text);
    return true;
  } catch {
    return false;
  }
}
