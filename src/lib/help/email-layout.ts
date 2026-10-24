// The shell every Help & feedback email shares: brand bar, one white card,
// quoted conversation history, a single call-to-action, quiet footer. Table
// layout and inline styles only, because mail clients ignore everything else.
// The audience line ("NextChapter · Candidate") is appended by createResend.

export const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
const NAVY = '#0f1b2b'
const BRAND = '#1d4e89'
const ORANGE = '#f4a259'
const MUTED = '#55606e'
const RULE = '#e3e8ef'

/** User text as safe HTML: escaped, blank lines become paragraphs, single newlines become breaks. */
export function textToHtml(text: string, style = `margin:0 0 14px;font-size:16px;line-height:1.65;color:${NAVY}`): string {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="${style}">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export const stamp = (d: Date): string =>
  d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })

export type ThreadMessage = { fromTeam: boolean; body: string; at: Date }

/** Earlier messages in the conversation, oldest first, quoted under the new one. */
export function conversationHistoryHtml(messages: ThreadMessage[], yourLabel: string): string {
  if (messages.length === 0) return ''
  const rows = messages.map((m) => `
    <tr><td style="padding:0 0 14px">
      <p style="margin:0 0 4px;font-size:12px;color:${MUTED}"><strong style="color:${NAVY}">${m.fromTeam ? 'NextChapter' : escapeHtml(yourLabel)}</strong> · ${stamp(m.at)}</p>
      <div style="border-left:3px solid ${m.fromTeam ? BRAND : RULE};padding:2px 0 2px 12px;font-size:14px;line-height:1.55;color:${MUTED};white-space:pre-wrap">${escapeHtml(m.body.length > 600 ? `${m.body.slice(0, 599)}…` : m.body)}</div>
    </td></tr>`).join('')
  return `
    <tr><td style="padding:8px 32px 0"><div style="border-top:1px solid ${RULE};padding-top:20px">
      <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND}">Earlier in this conversation</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    </div></td></tr>`
}

export function conversationHistoryText(messages: ThreadMessage[], yourLabel: string): string {
  if (messages.length === 0) return ''
  const body = messages.map((m) => `${m.fromTeam ? 'NextChapter' : yourLabel} · ${stamp(m.at)}\n${m.body.split('\n').map((l) => `> ${l}`).join('\n')}`).join('\n\n')
  return `\n\n— Earlier in this conversation —\n\n${body}`
}

/** A labelled facts table (From, Portal, Page…) for the internal notification. */
export function factsHtml(rows: [string, string | null | undefined][]): string {
  const shown = rows.filter(([, v]) => v)
  if (shown.length === 0) return ''
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;font-size:14px;line-height:1.5">${shown
    .map(([k, v]) => `<tr><td style="padding:2px 16px 2px 0;color:${MUTED};white-space:nowrap;vertical-align:top">${escapeHtml(k)}</td><td style="padding:2px 0;color:${NAVY}">${escapeHtml(v!)}</td></tr>`)
    .join('')}</table>`
}

export function buttonHtml(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 4px"><tr><td style="border-radius:8px;background:${NAVY}"><a href="${href}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;font-family:${FONT}">${escapeHtml(label)}</a></td></tr></table>`
}

export function callout(html: string, tone: 'alert' | 'note' = 'note'): string {
  const [bg, border, color] = tone === 'alert' ? ['#fdf0ee', '#e8b4ab', '#9b3b2f'] : ['#f3f6fa', RULE, NAVY]
  return `<div style="margin:0 0 18px;padding:12px 14px;border:1px solid ${border};background:${bg};border-radius:8px;font-size:14px;line-height:1.55;color:${color}">${html}</div>`
}

/** The full document. `bodyHtml` is the card content; `history` is already rows from conversationHistoryHtml. */
export function emailDocument(opts: { preheader: string; label: string; bodyHtml: string; history?: string; footer?: string }): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(opts.label)}</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:${FONT}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(opts.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${RULE}">
      <tr><td style="background:${NAVY};padding:18px 32px;border-bottom:3px solid ${ORANGE}">
        <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.01em">NextChapter</span>
        <span style="font-size:12px;color:#aab6c6;margin-left:10px;letter-spacing:0.06em;text-transform:uppercase">${escapeHtml(opts.label)}</span>
      </td></tr>
      <tr><td style="padding:28px 32px 8px;color:${NAVY}">${opts.bodyHtml}</td></tr>
      ${opts.history ?? ''}
      <tr><td style="padding:20px 32px 26px"><p style="margin:0;border-top:1px solid ${RULE};padding-top:16px;font-size:12px;line-height:1.6;color:${MUTED}">${opts.footer ?? 'Questions? Reply to this email or write to <a href="mailto:support@launchyournextchapter.com" style="color:' + BRAND + '">support@launchyournextchapter.com</a>.'}</p></td></tr>
    </table>
  </td></tr></table>
</body></html>`
}
