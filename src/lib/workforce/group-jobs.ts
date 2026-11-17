// Jobs for an organization's group, pure parts: reading a pasted list of jobs into rows, and the status words. No database here.

export type JobRow = { title: string; company: string; location: string | null; url: string }
export type JobLineError = { line: number; text: string; reason: string }

export const MAX_IMPORT = 100

const cleanUrl = (raw: string): string | null => {
  try {
    const u = new URL(raw.trim())
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null
  } catch {
    return null
  }
}

/** Split one line into fields: tab, pipe, or comma (commas inside double quotes stay). */
function fields(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map((s) => s.trim())
  if (line.includes('|')) return line.split('|').map((s) => s.trim())
  const out: string[] = []
  let cur = ''
  let q = false
  for (const ch of line) {
    if (ch === '"') q = !q
    else if (ch === ',' && !q) {
      out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  out.push(cur.trim())
  return out
}

/**
 * Pasted rows: title, company, location, link (in that order, one job a line; a header line is skipped). A line that is only a link is
 * refused with a reason, because a title and a company are needed. Duplicate links in the paste are dropped. At most MAX_IMPORT rows.
 */
export function parseJobRows(text: string): { rows: JobRow[]; errors: JobLineError[]; truncated: boolean } {
  const rows: JobRow[] = []
  const errors: JobLineError[] = []
  const seen = new Set<string>()
  const lines = text.split(/\r?\n/)
  let truncated = false
  lines.forEach((raw, i) => {
    const line = raw.trim()
    if (!line) return
    const f = fields(line).filter((x, idx, a) => !(idx === a.length - 1 && x === '' && a.length > 4))
    if (i === 0 && /^title$/i.test(f[0] ?? '') && /link|url/i.test(f[f.length - 1] ?? '')) return
    if (f.length < 4) {
      errors.push({ line: i + 1, text: line.slice(0, 80), reason: 'Use title, company, location, link.' })
      return
    }
    const [title, company, location, link] = f
    const url = cleanUrl(link)
    if (!title || title.length > 160) return void errors.push({ line: i + 1, text: line.slice(0, 80), reason: 'The title is missing or too long.' })
    if (!company || company.length > 160) return void errors.push({ line: i + 1, text: line.slice(0, 80), reason: 'The company is missing or too long.' })
    if (!url) return void errors.push({ line: i + 1, text: line.slice(0, 80), reason: 'The link must start with http:// or https://.' })
    if (seen.has(url)) return void errors.push({ line: i + 1, text: line.slice(0, 80), reason: 'The same link appears twice.' })
    if (rows.length >= MAX_IMPORT) {
      truncated = true
      return
    }
    seen.add(url)
    rows.push({ title, company, location: location || null, url })
  })
  return { rows, errors, truncated }
}

/** What a group's job listing is waiting on, in plain words. */
export function jobStatusLabel(status: string, archived: boolean, expired: boolean): string {
  if (archived) return 'Removed'
  if (status === 'approved') return expired ? 'Expired' : 'Live for your group'
  if (status === 'rejected') return 'Not approved'
  if (status === 'org_pending') return 'Waiting for your review'
  return 'Waiting for NextChapter review'
}

/** A group listing, as stored: waiting for NextChapter review, visible only to the organization's group once approved. */
export const GROUP_JOB_DAYS = 60

export function groupPostingData(institutionId: string, addedBy: string, p: { title: string; companyName: string; companyId: string | null; location: string | null; url: string; description?: string | null; salaryMin?: number | null; salaryMax?: number | null }) {
  return {
    title: p.title,
    companyName: p.companyName,
    companyId: p.companyId,
    location: p.location,
    url: p.url,
    description: p.description ?? null,
    postingType: 'direct',
    salaryMin: p.salaryMin ?? null,
    salaryMax: p.salaryMax ?? null,
    salaryCurrency: 'USD',
    audienceTier: 'ALL_CANDIDATES',
    distribution: 'OPEN',
    disclosure: 'OPEN',
    // Reviewed by a NextChapter admin before the group sees it, like every posting that is not from our own team.
    status: 'pending',
    source: 'institution',
    addedBy,
    institutionScopeId: institutionId,
    expiresAt: new Date(Date.now() + GROUP_JOB_DAYS * 86_400_000),
  }
}

