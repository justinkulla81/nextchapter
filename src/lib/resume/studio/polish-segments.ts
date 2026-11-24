import type { ResumeDocumentData } from '@/lib/resume/export/document-data'

/**
 * The resume's own words, cut into addressable pieces: one per bullet, title, summary and so on. A fix names
 * the piece it is for, so it can be shown beside the original and applied to exactly that piece, and only when
 * the piece still reads as it did when the fix was found.
 */
export interface Segment {
  id: string
  /** Where it is, in words a person recognises: "Bullet 2, Partner at Harbor Group". */
  label: string
  text: string
}

const roleName = (r: { roleTitle: string; companyName: string }) => [r.roleTitle, r.companyName].filter(Boolean).join(' at ') || 'a role'

export function segmentsOf(doc: ResumeDocumentData): Segment[] {
  const out: Segment[] = []
  const add = (id: string, label: string, text: string | null | undefined) => {
    if (text && text.trim()) out.push({ id, label, text })
  }
  add('summary', 'Summary', doc.summary)
  add('title', 'Title under your name', doc.targetTitle)
  doc.workHistory.forEach((r, i) => {
    const name = roleName(r)
    add(`role:${i}:title`, `Job title, ${name}`, r.roleTitle)
    add(`role:${i}:company`, `Company, ${name}`, r.companyName)
    add(`role:${i}:location`, `Location, ${name}`, r.location)
    ;(r.extraRoles ?? []).forEach((x, j) => add(`role:${i}:extra:${j}:title`, `Another title, ${name}`, x.roleTitle))
    r.bullets.forEach((b, k) => add(`role:${i}:bullet:${k}`, `Bullet ${k + 1}, ${name}`, b))
  })
  doc.education.forEach((e, i) => {
    add(`edu:${i}:school`, `School ${i + 1}`, e.schoolName)
    add(`edu:${i}:degree`, `Degree, ${e.schoolName || `school ${i + 1}`}`, e.degreeLabel)
  })
  doc.skills.forEach((s, i) => add(`skill:${i}`, 'Skills', s))
  ;(doc.sections ?? []).forEach((s, si) => {
    add(`sec:${si}:heading`, `Section heading, ${s.heading || `section ${si + 1}`}`, s.heading)
    s.items.forEach((it, j) => {
      add(`sec:${si}:item:${j}:title`, `${s.heading}: item ${j + 1} title`, it.title)
      add(`sec:${si}:item:${j}:subtitle`, `${s.heading}: item ${j + 1} detail`, it.subtitle)
      it.bullets.forEach((b, k) => add(`sec:${si}:item:${j}:bullet:${k}`, `${s.heading}: item ${j + 1}, bullet ${k + 1}`, b))
    })
  })
  return out
}

/** Order of a segment in the document, for sorting fixes top to bottom. */
export function segmentOrder(doc: ResumeDocumentData): Map<string, number> {
  return new Map(segmentsOf(doc).map((s, i) => [s.id, i]))
}

/**
 * Replaces one piece of the document. Returns null, changing nothing, when the piece is gone or no longer reads
 * `expected`: a fix found against older wording must never overwrite what the person has typed since.
 */
export function applySegment(doc: ResumeDocumentData, id: string, expected: string, replacement: string): ResumeDocumentData | null {
  const next = structuredClone(doc)
  const p = id.split(':')
  const n = (s: string | undefined) => (s === undefined || !/^\d+$/.test(s) ? -1 : Number(s))
  const swap = (cur: string | null | undefined, set: (v: string) => void) => {
    if (cur === null || cur === undefined || cur !== expected) return null
    set(replacement)
    return next
  }
  if (id === 'summary') return swap(next.summary, (v) => (next.summary = v))
  if (id === 'title') return swap(next.targetTitle, (v) => (next.targetTitle = v))
  if (p[0] === 'role') {
    const r = next.workHistory[n(p[1])]
    if (!r) return null
    if (p[2] === 'title') return swap(r.roleTitle, (v) => (r.roleTitle = v))
    if (p[2] === 'company') return swap(r.companyName, (v) => (r.companyName = v))
    if (p[2] === 'location') return swap(r.location, (v) => (r.location = v))
    if (p[2] === 'extra') {
      const x = (r.extraRoles ?? [])[n(p[3])]
      return x ? swap(x.roleTitle, (v) => (x.roleTitle = v)) : null
    }
    if (p[2] === 'bullet') {
      const k = n(p[3])
      return k >= 0 && k < r.bullets.length ? swap(r.bullets[k], (v) => (r.bullets[k] = v)) : null
    }
  }
  if (p[0] === 'edu') {
    const e = next.education[n(p[1])]
    if (!e) return null
    if (p[2] === 'school') return swap(e.schoolName, (v) => (e.schoolName = v))
    if (p[2] === 'degree') return swap(e.degreeLabel, (v) => (e.degreeLabel = v))
  }
  if (p[0] === 'skill') {
    const i = n(p[1])
    return i >= 0 && i < next.skills.length ? swap(next.skills[i], (v) => (next.skills[i] = v)) : null
  }
  if (p[0] === 'sec') {
    const s = next.sections?.[n(p[1])]
    if (!s) return null
    if (p[2] === 'heading') return swap(s.heading, (v) => (s.heading = v))
    if (p[2] === 'item') {
      const it = s.items[n(p[3])]
      if (!it) return null
      if (p[4] === 'title') return swap(it.title, (v) => (it.title = v))
      if (p[4] === 'subtitle') return swap(it.subtitle, (v) => (it.subtitle = v))
      if (p[4] === 'bullet') {
        const k = n(p[5])
        return k >= 0 && k < it.bullets.length ? swap(it.bullets[k], (v) => (it.bullets[k] = v)) : null
      }
    }
  }
  return null
}
