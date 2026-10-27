export function recoveryRedirect(appUrl: string, production: boolean): string {
  const url = new URL(appUrl);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('APP_URL must be an origin.');
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('APP_URL must be HTTP(S).');
  const local = url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || url.hostname === '[::1]' || /^127\./.test(url.hostname) || url.hostname === '0.0.0.0';
  if (production && (url.protocol !== 'https:' || local)) throw new Error('Production recovery requires a public HTTPS APP_URL.');
  return `${url.origin}/reset-password`;
}
