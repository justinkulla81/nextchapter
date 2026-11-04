// A job alert saved from a job page or a topic page is about one thing: the employer, the job title, the industry or the function.
// It rides in HomepageLead.searchQ as "company:Acme", "title:marketing manager", "industry:Healthcare & Hospital Systems" or "function:Finance",
// so no new column is needed. Plain search words never start with these prefixes (the search box does not write them).

export type AlertScopeKind = 'company' | 'title' | 'industry' | 'function'
export interface AlertScope {
  kind: AlertScopeKind
  value: string
}

const SCOPE = /^(company|title|industry|function):([\s\S]+)$/

export const scopeQ = (kind: AlertScopeKind, value: string): string => `${kind}:${value.trim().slice(0, 100)}`

export function parseScope(q: string): AlertScope | null {
  const m = SCOPE.exec(q.trim())
  if (!m || !m[2].trim()) return null
  return { kind: m[1] as AlertScopeKind, value: m[2].trim() }
}
