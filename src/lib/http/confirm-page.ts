// Minimal standalone HTML for action links that must not change anything on a
// plain GET (mail scanners and link previewers fetch every URL in an email).
// The button POSTs back to the same URL; the route does the work on POST.

const STYLE = 'font-family: -apple-system, sans-serif; max-width: 480px; margin: 64px auto; padding: 0 24px; color: #111;'
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function messagePage(message: string, status = 200): Response {
  return new Response(`<!doctype html><html><body style="${STYLE}"><p>${esc(message)}</p></body></html>`, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  })
}

export function confirmPage(opts: { message: string; button: string; action: string }): Response {
  return new Response(
    `<!doctype html><html><body style="${STYLE}"><p>${esc(opts.message)}</p>` +
      `<form method="POST" action="${esc(opts.action)}"><button type="submit" style="font-size:16px;padding:10px 18px;cursor:pointer;">${esc(opts.button)}</button></form></body></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
  )
}

/** A page with two buttons: a recommended alternative and the confirm action. Neither changes anything on GET. */
export function choicePage(opts: {
  message: string
  primary: { label: string; action: string }
  secondary: { label: string; action: string }
  footer?: { label: string; href: string }
}): Response {
  const btn = (label: string, action: string, strong: boolean) =>
    `<form method="POST" action="${esc(action)}" style="margin:12px 0"><button type="submit" style="font-size:16px;padding:10px 18px;cursor:pointer;${strong ? 'font-weight:600;' : ''}">${esc(label)}</button></form>`
  return new Response(
    `<!doctype html><html><body style="${STYLE}"><p>${esc(opts.message)}</p>` +
      btn(opts.primary.label, opts.primary.action, true) +
      btn(opts.secondary.label, opts.secondary.action, false) +
      (opts.footer ? `<p style="margin-top:24px;font-size:14px"><a href="${esc(opts.footer.href)}">${esc(opts.footer.label)}</a></p>` : '') +
      `</body></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
  )
}
