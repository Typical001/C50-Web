// Keep identical across Web, Admin and Android; covered by cross-client contract tests.
export function notesLink(value: unknown): { url: string; drive: boolean; embed: boolean } | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim();
  if (!/^https:\/\//i.test(raw) || /[\u0000-\u0020\\]/.test(raw)) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const drive = url.hostname === 'drive.google.com';
    if (drive) {
      const file = /^\/file\/d\/([A-Za-z0-9_-]+)(?:\/(?:view|preview|edit))?\/?$/.exec(url.pathname);
      const ids = url.searchParams.getAll('id');
      const queryFile = /^\/(?:open|uc)\/?$/.test(url.pathname) && ids.length === 1 && /^[A-Za-z0-9_-]+$/.test(ids[0]);
      if (!file && !queryFile) return null;
    }
    return { url: raw, drive, embed: !drive && /\.pdf$/i.test(url.pathname) };
  } catch { return null; }
}
export const notesLinkError = 'Use an HTTPS PDF URL or a Google Drive file-sharing link, without a username or password. Drive folder links are not supported.';

export async function openNotes(value: unknown, authorize: () => Promise<unknown>, open: (url: string) => Promise<unknown>) {
  await authorize();
  const link = notesLink(value);
  if (!link) throw new Error(notesLinkError);
  await open(link.url);
}
