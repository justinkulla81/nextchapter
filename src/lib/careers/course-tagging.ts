import { normalizeSkillText } from '@/lib/careers/vectors'

/**
 * Decides which taxonomy skills a course teaches by finding the skill's name
 * as a whole phrase in the course's own text (title, description, keywords).
 * Deliberately conservative: a missed tag costs a course a slot in a list; a
 * wrong tag sends someone to the wrong course for the gap they were shown.
 *
 * Tools match on the tool's name. O*NET knowledge areas are broad ("Economics
 * and Accounting"), so they match on their distinctive parts, with generic
 * parts like "management" or "service" ignored. Generic O*NET skills ("Critical
 * Thinking") are never auto-tagged.
 */
export interface TaggableSkill {
  id: string
  name: string
  kind: 'SKILL' | 'KNOWLEDGE' | 'ABILITY' | 'ACTIVITY' | 'TECHNOLOGY'
}

const GENERIC_PARTS = new Set([
  'management', 'administration', 'administrative', 'service', 'services', 'education', 'training', 'design',
  'engineering', 'technology', 'communications', 'media', 'computers', 'electronics', 'production', 'processing',
  'personal', 'clerical', 'mechanical', 'english', 'language', 'customer', 'building', 'construction',
])
// Tools whose names are too common in course text to say anything about what is taught.
const GENERIC_TOOLS = new Set(['microsoft office', 'microsoft windows', 'internet', 'email', 'e mail', 'spreadsheet'])

export function skillMatchTerms(skill: TaggableSkill): string[] {
  // Only named tools and knowledge areas are tagged. Skills, abilities and work activities are too generic to say what a course teaches.
  if (skill.kind !== 'TECHNOLOGY' && skill.kind !== 'KNOWLEDGE') return []
  const name = normalizeSkillText(skill.name)
  if (skill.kind === 'TECHNOLOGY') {
    return name.length >= 3 && !GENERIC_TOOLS.has(name) ? [name] : []
  }
  return skill.name
    .split(/\s+and\s+|,/i)
    .map(normalizeSkillText)
    .filter((part) => part.length >= 5 && !part.split(' ').every((w) => GENERIC_PARTS.has(w)))
}

function containsPhrase(haystack: string, phrase: string): boolean {
  const padded = ` ${haystack} `
  return padded.includes(` ${phrase} `) || padded.includes(` ${phrase}s `)
}

const MAX_TAGS_PER_COURSE = 8

export function tagCourse(course: { title: string; description: string; keywords: string[] }, skills: TaggableSkill[]): string[] {
  const text = normalizeSkillText([course.title, course.description, ...course.keywords].join(' '))
  const hits: { id: string; kind: TaggableSkill['kind']; length: number }[] = []
  for (const skill of skills) {
    const terms = skillMatchTerms(skill)
    const hit = terms.find((t) => containsPhrase(text, t))
    if (hit) hits.push({ id: skill.id, kind: skill.kind, length: hit.length })
  }
  return hits
    .sort((a, b) => Number(b.kind === 'TECHNOLOGY') - Number(a.kind === 'TECHNOLOGY') || b.length - a.length || a.id.localeCompare(b.id))
    .slice(0, MAX_TAGS_PER_COURSE)
    .map((h) => h.id)
}
