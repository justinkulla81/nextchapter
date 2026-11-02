// A job alert saved from a job page is about one thing: the employer, the job title, or the industry.
// It rides in HomepageLead.searchQ as "company:Acme", "title:marketing manager" or "industry:Healthcare & Hospital Systems",
// so no new column is needed. Plain search words never start with these prefixes (the search box does not write them).

export type AlertScopeKind = 'company' | 'title' | 'industry'
export interface AlertScope {
  kind: AlertScopeKind
  value: string
}

const SCOPE = /^(company|title|industry):([\s\S]+)$/

export const scopeQ = (kind: AlertScopeKind, value: string): string => `${kind}:${value.trim().slice(0, 100)}`

export function parseScope(q: string): AlertScope | null {
  const m = SCOPE.exec(q.trim())
  if (!m || !m[2].trim()) return null
  return { kind: m[1] as AlertScopeKind, value: m[2].trim() }
}
