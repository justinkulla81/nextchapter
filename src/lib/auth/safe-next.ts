// Post-login / post-reset destinations arrive in a `next` query param, so they
// are attacker-controlled. Accept only a same-origin absolute path: it must
// start with a single "/" and not "//" or "/\" (both parse as protocol-
// relative URLs in browsers), and may not contain a scheme or control chars.
export function safeNext(next: string | null | undefined, fallback: string): string {
  if (!next) return fallback
  if (!/^\/(?![/\\])/.test(next)) return fallback
  if (/[\u0000-\u001f\u007f]/.test(next) || next.includes('://')) return fallback
  return next
}
