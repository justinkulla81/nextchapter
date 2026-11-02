// Sorts a newly found outside course into the catalog's own terms: which function it is for (the
// canonical names resolveContentFunction returns), which AI level, and which category. Pure and
// client-safe; tested in src/test/course-scan.test.ts. A rule here is a first guess for a person to
// confirm in the admin queue, never a final label.
import type { CourseCategory, CourseSkillLevel } from '@prisma/client'

export interface FoundCourse {
  url: string
  title: string
  description: string
  /** Level the provider states, when it does (Microsoft Learn does). */
  providerLevel?: string | null
}

export interface CourseGuess {
  functions: string[]
  /** Lowercase catalog keywords for a FUNCTION_TRAINING row. */
  keywords: string[]
  skillLevel: CourseSkillLevel
  category: CourseCategory
  /** AI-related at all; a course that is not stays out of the queue. */
  aiRelated: boolean
}

// Word-boundary patterns, so "law" does not match "flaw" and "hr" does not match "through".
const FUNCTION_RULES: { fn: string; keywords: string[]; pattern: RegExp }[] = [
  { fn: 'Finance', keywords: ['finance', 'accounting'], pattern: /\b(financ\w*|bond|credit|portfolio|accounting|audit\w*|tax|treasury|banking|investment|wealth|fp&a|underwriting)\b/i },
  { fn: 'Legal', keywords: ['legal', 'compliance'], pattern: /\b(legal|law|lawyers?|attorneys?|paralegal|contracts?|nda|dsar|redact\w*|litigation|regulat\w+|compliance|privacy)\b/i },
  { fn: 'Human Resources', keywords: ['human resources', 'talent'], pattern: /\b(hr|human resources|recruit\w*|talent|hiring|people operations)\b/i },
  { fn: 'Marketing', keywords: ['marketing'], pattern: /\b(marketing|marketers?|seo|brand|advertising|campaigns?)\b/i },
  { fn: 'Sales', keywords: ['sales'], pattern: /\b(sales|selling|revenue teams?|account executives?)\b/i },
  { fn: 'Operations', keywords: ['operations'], pattern: /\b(operations|supply chain|logistics|procurement)\b/i },
  { fn: 'Customer Success', keywords: ['customer success', 'customer support'], pattern: /\b(customer (success|support|service)|contact centers?)\b/i },
  { fn: 'Data & Analytics', keywords: ['data & analytics', 'analytics'], pattern: /\b(data analy\w+|analytics|business intelligence|data science)\b/i },
  { fn: 'Product', keywords: ['product management'], pattern: /\bproduct (managers?|management)\b/i },
  { fn: 'Administration', keywords: ['administration'], pattern: /\b(administrative|executive assistants?|office managers?)\b/i },
]

const AI_PATTERN = /\b(ai|a\.i\.|gen ?ai|generative|gemini|claude|copilot|chatgpt|gpt|llm|agents?|agentic|prompt\w*|machine learning|rag|mcp)\b/i
const BEGINNER_PATTERN = /\b(intro\w*|essentials?|fundamentals?|basics?|beginners?|getting started|first steps|101|for everyone|foundations?)\b/i
const ADVANCED_PATTERN = /\b(advanced|architect\w*|professional certificate|expert|production|enterprise-scale|fine-?tuning|mlops|evaluation)\b/i

export function classifyCourse(c: FoundCourse): CourseGuess {
  const text = `${c.title} ${c.description}`
  const functions = FUNCTION_RULES.filter((r) => r.pattern.test(c.title) || r.pattern.test(c.description.slice(0, 300))).map((r) => r.fn)
  const keywords = FUNCTION_RULES.filter((r) => functions.includes(r.fn)).flatMap((r) => r.keywords)
  const provider = (c.providerLevel ?? '').toLowerCase()
  const skillLevel: CourseSkillLevel =
    provider === 'beginner' ? 'BEGINNER'
    : provider === 'advanced' ? 'ADVANCED'
    : ADVANCED_PATTERN.test(c.title) ? 'ADVANCED'
    : BEGINNER_PATTERN.test(c.title) ? 'BEGINNER'
    : 'INTERMEDIATE'
  return {
    functions,
    keywords,
    skillLevel,
    category: functions.length > 0 ? 'FUNCTION_TRAINING' : 'AI_TRAINING',
    aiRelated: AI_PATTERN.test(text),
  }
}

export const LEVEL_WORD: Record<CourseSkillLevel, string> = { BEGINNER: 'beginner', INTERMEDIATE: 'intermediate', ADVANCED: 'advanced' }
