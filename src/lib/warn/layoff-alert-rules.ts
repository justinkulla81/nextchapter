/**
 * When a newly filed layoff is worth an email now instead of at the next
 * morning digest, and what that email and the notice's label say. Pure, so
 * the rules are testable without a database or a mail server.
 */
export const ALERT_MIN_EMPLOYEES = 250

export type LayoffKind = 'news' | 'sec' | 'warn'

export interface AlertInput {
  employer: string
  employees: number | null
  percent: number | null
  kind: LayoffKind
  confirmed: boolean
  inCrm: boolean
  /** People we know at the company, and how many of them are warm. */
  people: number
  warm: number
  contactsFound: number
}

export function shouldAlert(a: Pick<AlertInput, 'employees' | 'inCrm'>): boolean {
  return (a.employees ?? 0) >= ALERT_MIN_EMPLOYEES || a.inCrm
}

export const sizeLabel = (employees: number | null, percent: number | null): string =>
  employees ? `${employees.toLocaleString('en-US')} jobs` : percent ? `${percent}% of staff` : 'size unknown'

export function alertSubject(a: AlertInput): string {
  return `Layoff alert: ${a.employer} (${sizeLabel(a.employees, a.percent)})${a.inCrm ? ' — in your CRM' : ''}${a.confirmed ? '' : ' — unconfirmed'}`
}

const KIND_LABEL: Record<LayoffKind, string> = {
  news: 'News report', sec: 'SEC 8-K filing', warn: 'WARN filing',
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function alertBody(a: AlertInput, links: { source: string | null; org: string | null; notices: string }): string {
  const rows: [string, string][] = [
    ['Company', esc(a.employer)],
    ['Size', esc(sizeLabel(a.employees, a.percent)) + (a.employees && a.percent ? ` (${a.percent}% of staff)` : '')],
    ['Source', esc(KIND_LABEL[a.kind]) + (a.confirmed ? '' : ' — one outlet so far, unconfirmed')],
  ]
  if (a.inCrm) {
    rows.push(['In your CRM', a.people
      ? `${a.people} ${a.people === 1 ? 'person' : 'people'}${a.warm ? `, ${a.warm} warm` : ', none warm'}`
      : 'organization only, no contacts'])
  }
  if (a.contactsFound) rows.push(['Named contacts found', String(a.contactsFound)])
  const link = (href: string | null, text: string) => (href ? `<a href="${esc(href)}">${esc(text)}</a>` : '')
  return `<div style="font:14px/1.5 -apple-system,Segoe UI,sans-serif;color:#111">
<table cellpadding="4" style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="color:#666;padding-right:12px">${k}</td><td>${v}</td></tr>`).join('')}</table>
<p>${[link(links.source, 'Source'), link(links.org, 'CRM organization'), link(links.notices, 'Layoff notices')].filter(Boolean).join(' · ')}</p>
<p style="color:#666">Primary contact is settled in the 7 AM run, warm lead first.</p>
</div>`
}

/** The notice's label: how many outlets, and the share of staff when the text gave one. */
export function layoffTypeLabel(o: { publishers: number; publisher: string | null; percent: number | null }): string {
  const base = o.publishers >= 2
    ? `Reported by ${o.publishers} publishers`
    : `Reported by 1 publisher (${o.publisher ?? 'unknown'}) — unconfirmed`
  return o.percent ? `${base} · ${o.percent}% of staff` : base
}
