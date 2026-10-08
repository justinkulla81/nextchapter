/**
 * Turns a composed edition into the email one person receives.
 *
 * It must read as a personal note from Justin: no banner, logo or template
 * chrome — the body, a sign-off, and one small grey footer line. Formatting
 * is limited to what the composer offers (bold, underline, italics, bullets,
 * links); anything else is stripped here, so pasted or tampered HTML can
 * never reach a recipient.
 */

const ALLOWED = new Set(['p', 'div', 'br', 'b', 'strong', 'u', 'i', 'em', 'ul', 'ol', 'li', 'a'])

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function safeHref(raw: string): string | null {
  const href = raw.trim().replace(/&amp;/g, '&')
  if (/^(https?:|mailto:)/i.test(href)) return href
  // Merge tags are allowed as a whole link target ({{reportUrl}}).
  if (/^\{\{\s*\w+\s*\}\}$/.test(href)) return href
  return null
}

export function sanitizeBodyHtml(input: string): string {
  let s = input
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|head|title|iframe|object)[\s\S]*?<\/\1\s*>/gi, '')
  s = s.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (full, rawTag: string, attrs: string) => {
    const tag = rawTag.toLowerCase()
    if (!ALLOWED.has(tag)) return ''
    const closing = full.startsWith('</')
    if (closing) return tag === 'br' ? '' : `</${tag}>`
    if (tag === 'a') {
      const m = attrs.match(/href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i)
      const href = m ? safeHref(m[2] ?? m[3] ?? m[4] ?? '') : null
      return href ? `<a href="${escapeHtml(href)}">` : '<a>'
    }
    return tag === 'br' ? '<br>' : `<${tag}>`
  })
  // Any stray angle bracket left is text, not markup.
  s = s.replace(/<(?![/a-z])/gi, '&lt;')
  // Paragraph spacing comes from margins, so the blank paragraphs the editor
  // leaves behind (Enter twice) would only double the gap.
  return s.replace(/<(p|div)>(?:\s|&nbsp;|<br>)*<\/\1>/gi, '').trim()
}

/**
 * Gmail and Outlook ignore stylesheets, and the admin preview sits under
 * Tailwind's reset, so spacing and bullets are written onto each tag. The
 * preview renders this same HTML, so what Justin sees is what lands.
 */
const INLINE: Record<string, string> = {
  p: 'margin:0 0 12px 0',
  ul: 'list-style-type:disc;padding-left:24px;margin:0 0 12px 0',
  ol: 'list-style-type:decimal;padding-left:24px;margin:0 0 12px 0',
  li: 'margin:0 0 6px 0',
}

function inlineStyles(html: string): string {
  return html.replace(/<(p|ul|ol|li)>/g, (_m, tag: string) => `<${tag} style="${INLINE[tag]}">`)
}

/** Plain text for the text/plain part and for previews. */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li>/gi, '\n• ')
    .replace(/<\/(p|div|ul|ol)>/gi, '\n\n')
    .replace(/<a href="([^"]*)">([\s\S]*?)<\/a>/gi, (_m, href: string, text: string) =>
      text.replace(/<[^>]+>/g, '').trim() === href ? href : `${text} (${href})`)
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export interface MergeValues {
  firstName: string | null
  orgName: string | null
  reportUrl: string | null
}

export function applyMergeTags(html: string, v: MergeValues): string {
  return html
    .replace(/\{\{\s*firstName\s*\}\}/g, escapeHtml(v.firstName?.trim() || 'there'))
    .replace(/\{\{\s*orgName\s*\}\}/g, escapeHtml(v.orgName?.trim() || 'your team'))
    .replace(/\{\{\s*reportUrl\s*\}\}/g, escapeHtml(v.reportUrl ?? ''))
}

export interface RenderInput {
  bodyHtml: string
  previewText?: string | null
  reportUrl?: string | null
  merge: MergeValues
  footerText: string
  postalAddress: string
  unsubscribeUrl: string
}

const WRAP = 'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2328;max-width:600px'

function footerHtml(text: string, postalAddress: string, unsubscribeUrl: string): string {
  const escaped = escapeHtml(text.replace(/\{\{\s*postalAddress\s*\}\}/g, postalAddress))
  const linked = /\[([^\]]+)\]/.test(escaped)
    ? escaped.replace(/\[([^\]]+)\]/, `<a href="${escapeHtml(unsubscribeUrl)}" style="color:#8a8f98">$1</a>`)
    : `${escaped} <a href="${escapeHtml(unsubscribeUrl)}" style="color:#8a8f98">Unsubscribe</a>`
  return `<p style="margin-top:32px;font-size:12px;line-height:1.5;color:#8a8f98">${linked}</p>`
}

export function renderEmail(input: RenderInput): { html: string; text: string } {
  let body = applyMergeTags(sanitizeBodyHtml(input.bodyHtml), { ...input.merge, reportUrl: input.reportUrl ?? null })
  // A report link the body doesn't already carry goes at the end, plainly.
  if (input.reportUrl && !body.includes(escapeHtml(input.reportUrl))) {
    body += `<p><a href="${escapeHtml(input.reportUrl)}">${escapeHtml(input.reportUrl)}</a></p>`
  }
  const bodyText = htmlToText(body)
  const signed = /justin\s*$/i.test(bodyText)
  if (!signed) body += '<p>Justin</p>'
  body = inlineStyles(body)

  const preview = input.previewText
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(input.previewText)}</div>`
    : ''
  const html = `${preview}<div style="${WRAP}">${body}${footerHtml(input.footerText, input.postalAddress, input.unsubscribeUrl)}</div>`

  const footerPlain = input.footerText
    .replace(/\{\{\s*postalAddress\s*\}\}/g, input.postalAddress)
    .replace(/\[([^\]]+)\]/, `$1 (${input.unsubscribeUrl})`)
  const text = `${htmlToText(body)}\n\n--\n${/\(http/.test(footerPlain) ? footerPlain : `${footerPlain} Unsubscribe: ${input.unsubscribeUrl}`}`
  return { html, text }
}
