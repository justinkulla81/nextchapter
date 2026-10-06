/**
 * The industry sector of a WARN filing, from the NAICS code at the start of
 * what the state publishes ("54 Professional Scientific and Technical
 * Services", "48 (NAICS 488510)", "31-33 Manufacturing"). Only seven states
 * publish one; elsewhere the sector is unknown, never guessed.
 */
export const SECTOR_LABELS: Record<string, string> = {
  '11': 'Agriculture', '21': 'Mining', '22': 'Utilities', '23': 'Construction',
  '31': 'Manufacturing', '32': 'Manufacturing', '33': 'Manufacturing',
  '42': 'Wholesale', '44': 'Retail', '45': 'Retail', '48': 'Transportation & warehousing', '49': 'Transportation & warehousing',
  '51': 'Information', '52': 'Finance & insurance', '53': 'Real estate', '54': 'Professional & technical',
  '55': 'Management of companies', '56': 'Admin & staffing', '61': 'Education', '62': 'Health care',
  '71': 'Arts & recreation', '72': 'Hotels & food', '81': 'Other services', '92': 'Public administration',
}

/**
 * White-collar sectors, listed rather than inferred: Information, Finance
 * and insurance, Professional and technical services, Management of
 * companies. A sector not on the list is not white collar, however its
 * name reads.
 */
export const KNOWLEDGE_SECTORS = new Set(['51', '52', '54', '55'])

export function naicsSector(industry: string | null | undefined): string | null {
  const code = industry?.match(/^\s*(\d{2})/)?.[1]
  return code && SECTOR_LABELS[code] ? code : null
}

/** true / false where the sector is published; null where it is not. */
export function isKnowledgeWork(industry: string | null | undefined): boolean | null {
  const s = naicsSector(industry)
  return s ? KNOWLEDGE_SECTORS.has(s) : null
}
