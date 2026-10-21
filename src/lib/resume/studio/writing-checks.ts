import type { ResumeDocumentData } from '@/lib/resume/export/document-data'

/**
 * Plain, free writing checks for the resume editor. They look at how a line is
 * written, not whether it is true or good, and say so: every note explains what
 * to try, and none of them blocks saving or exporting.
 */
export type BulletNoteCode = 'WEAK_OPENER' | 'FIRST_PERSON' | 'NO_NUMBER' | 'TOO_LONG' | 'TOO_SHORT'

export interface BulletNote {
  code: BulletNoteCode
  message: string
}

const WEAK_OPENERS = [
  'responsible for',
  'duties included',
  'duties include',
  'tasked with',
  'worked on',
  'helped to',
  'helped',
  'assisted with',
  'assisted in',
  'involved in',
  'in charge of',
]

const MIN_WORDS_FOR_NUMBER_CHECK = 6
const LONG_BULLET_CHARS = 260
const SHORT_BULLET_CHARS = 25

export function checkBullet(text: string): BulletNote[] {
  const bullet = text.trim()
  if (!bullet) return []
  const notes: BulletNote[] = []
  const lower = bullet.toLowerCase()

  const weak = WEAK_OPENERS.find((w) => lower.startsWith(`${w} `) || lower === w)
  if (weak) {
    notes.push({
      code: 'WEAK_OPENER',
      message: `Starts with “${weak}”, which says what the job was, not what you did. Try opening with what you led, built, cut or grew.`,
    })
  }
  if (/^(i|my|me)\b/i.test(bullet)) {
    notes.push({ code: 'FIRST_PERSON', message: 'Resumes leave out “I” and “my”. Start with the action instead.' })
  }
  if (bullet.length > LONG_BULLET_CHARS) {
    notes.push({ code: 'TOO_LONG', message: 'This runs past about two printed lines. Try splitting it into two bullets.' })
  }
  if (bullet.length < SHORT_BULLET_CHARS) {
    notes.push({ code: 'TOO_SHORT', message: 'Very short. Add what you did and what came of it.' })
  }
  if (bullet.split(/\s+/).length >= MIN_WORDS_FOR_NUMBER_CHECK && !/\d/.test(bullet)) {
    notes.push({ code: 'NO_NUMBER', message: 'No number in this one. If you can, add a size, rate, time saved or dollar figure.' })
  }
  return notes
}

export interface DocumentSummary {
  bulletCount: number
  /** Bullets with at least one number in them. */
  quantifiedCount: number
  rolesWithoutBullets: string[]
  notedBullets: number
  summaryLength: number
}

export function summarizeDocument(doc: ResumeDocumentData): DocumentSummary {
  let bulletCount = 0
  let quantifiedCount = 0
  let notedBullets = 0
  const rolesWithoutBullets: string[] = []
  for (const w of doc.workHistory) {
    const bullets = w.bullets.map((b) => b.trim()).filter(Boolean)
    if (bullets.length === 0 && (w.roleTitle || w.companyName)) rolesWithoutBullets.push([w.roleTitle, w.companyName].filter(Boolean).join(', '))
    for (const b of bullets) {
      bulletCount++
      if (/\d/.test(b)) quantifiedCount++
      if (checkBullet(b).length > 0) notedBullets++
    }
  }
  return { bulletCount, quantifiedCount, rolesWithoutBullets, notedBullets, summaryLength: doc.summary?.trim().length ?? 0 }
}
