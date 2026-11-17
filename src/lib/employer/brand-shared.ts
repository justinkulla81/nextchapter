// Pure helpers for the employer brand (no database), shared by the server code, the forms and the tests.

export type EmployerBrandView = {
  logoUrl: string | null
  officeImageUrl: string | null
  productImageUrl: string | null
  productName: string | null
  tagline: string | null
}

// The row an employer's brand lives on: its directory Company when it has one (every section of that company shares the
// look), otherwise the hiring profile or outplacement org itself.
export function brandOwnerKey(owner: { companyId?: string | null; employerProfileId?: string | null; outplacementOrgId?: string | null }): string | null {
  if (owner.companyId) return `company:${owner.companyId}`
  if (owner.employerProfileId) return `employer:${owner.employerProfileId}`
  if (owner.outplacementOrgId) return `outplacement:${owner.outplacementOrgId}`
  return null
}

// Trimmed text with runs of spaces collapsed; null when blank; undefined when longer than `max`.
export function cleanBrandText(v: FormDataEntryValue | null, max: number): string | null | undefined {
  const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : ''
  if (!s) return null
  return s.length > max ? undefined : s
}
