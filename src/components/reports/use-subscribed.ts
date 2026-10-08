// Has this browser already subscribed? The server action sets a non-HttpOnly
// `nc_sub=1` cookie on success; the pop-up and the PDF gate read it so they
// never nag or gate a subscriber again. Safe to call only in the browser.
export function hasSubscribedCookie(): boolean {
  if (typeof document === 'undefined') return false
  return /(?:^|;\s*)nc_sub=1(?:;|$)/.test(document.cookie)
}
