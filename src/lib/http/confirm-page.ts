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
