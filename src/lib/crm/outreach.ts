import 'server-only'

const URL_PATTERN = /https?:\/\/[^\s<>"']+/g

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Turns plain composed text into the HTML actually sent: paragraphs from
 * blank-line breaks, single line breaks preserved, bare URLs replaced with
 * the given tracked redirect for each (`urlToLinkId` keyed by the exact
 * substring matched), and a 1x1 open-tracking pixel appended last.
 *
 * Composing in plain text rather than rich text is deliberate for a first
 * version — it sidesteps sanitizing arbitrary pasted HTML entirely, at the
 * cost of no bold/italic/etc. in what gets sent.
 */
export function buildTrackedHtml(plainText: string, urlToLinkId: Map<string, string>, trackingId: string): string {
  const linked = escapeHtml(plainText).replace(URL_PATTERN, (rawMatch) => {
    // escapeHtml already ran, so the map's original (unescaped) URL needs
    // the same treatment to compare — URLs never legitimately contain
    // & < > so escaping is a no-op for the vast majority of them anyway.
    const original = [...urlToLinkId.keys()].find((u) => escapeHtml(u) === rawMatch)
    const linkId = original ? urlToLinkId.get(original) : undefined
    if (!linkId) return rawMatch
    const clickUrl = `${appUrl()}/api/crm/outreach/click/${linkId}`
    return `<a href="${clickUrl}">${rawMatch}</a>`
  })

  const paragraphs = linked
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n')

  const pixel = `<img src="${appUrl()}/api/crm/outreach/open/${trackingId}" width="1" height="1" alt="" style="display:none" />`
  return `${paragraphs}\n${pixel}`
}

/** Every distinct URL in the composed text, in first-seen order. */
export function extractUrls(plainText: string): string[] {
  const found = plainText.match(URL_PATTERN) ?? []
  return [...new Set(found)]
}
