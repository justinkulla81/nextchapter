// The public AI course catalog (/ai-courses): how a Course row becomes pages by function, AI level and sponsor.
// Pure and client-safe so the same rules drive the pages, the sitemap and the tests (src/test/public-catalog.test.ts).
// Level and function are ours (a guess from the course's own description), and every page says so.
import type { CourseCategory, CourseSkillLevel } from '@prisma/client'
import { topicSlug } from '@/lib/seo/topics'

export interface PublicCourse {
  slug: string
  title: string
  sponsor: string
  description: string
  url: string
  /** LEARNING_PROVIDERS key, or the admin's own text. */
  provider: string
  free: boolean
  level: CourseSkillLevel
  category: CourseCategory
  /** Canonical function names this course is for. Empty for a general AI course that fits any role. */
  functions: string[]
  skills: string[]
}

export const AI_COURSES_PATH = '/ai-courses'

export interface CatalogFunction {
  name: string
  slug: string
  /** Lower-case noun for headings: "finance professionals". */
  people: string
  /** One plain sentence on where AI is landing in this function, for the page intro. */
  blurb: string
}

// The functions courses can be tagged to. Names match PRIMARY_FUNCTION_OPTIONS so a member's own function lines up.
export const CATALOG_FUNCTIONS: CatalogFunction[] = [
  { name: 'Finance', slug: 'finance', people: 'finance professionals', blurb: 'AI is changing forecasting, analysis, reporting and credit work, and finance postings name Copilot and Gemini most often.' },
  { name: 'Legal', slug: 'legal', people: 'legal professionals', blurb: 'AI now drafts and reviews contracts, redacts documents and scans regulation, so legal teams are expected to supervise it.' },
  { name: 'Human Resources', slug: 'human-resources', people: 'HR and recruiting professionals', blurb: 'AI is moving into sourcing, screening, onboarding and people analytics, with compliance rules attached.' },
  { name: 'Marketing', slug: 'marketing', people: 'marketing professionals', blurb: 'Content, campaigns, segmentation and measurement are being rebuilt around AI tools.' },
  { name: 'Sales', slug: 'sales', people: 'sales professionals', blurb: 'Prospecting, call prep, CRM updates and forecasting increasingly run through AI assistants and agents.' },
  { name: 'Operations', slug: 'operations', people: 'operations professionals', blurb: 'Process automation and AI agents are replacing manual handoffs in operations and supply chain work.' },
  { name: 'Customer Success', slug: 'customer-success', people: 'customer support and success professionals', blurb: 'AI agents now handle first-line support, so the human work shifts to escalations, quality and design of the AI.' },
  { name: 'Data & Analytics', slug: 'data-and-analytics', people: 'data and analytics professionals', blurb: 'Generative AI is now part of data preparation, analysis and storytelling, and it is the function where AI skills are named most.' },
  { name: 'Product', slug: 'product', people: 'product managers', blurb: 'Product managers are expected to scope, evaluate and ship AI features, and to use AI in their own research and planning.' },
  { name: 'Design', slug: 'design', people: 'designers', blurb: 'Generative tools are entering research, ideation and prototyping across UX and product design.' },
  { name: 'Engineering', slug: 'engineering', people: 'engineers', blurb: 'AI coding assistants and AI system design are now part of the engineering job.' },
  { name: 'Administration', slug: 'administration', people: 'administrative professionals', blurb: 'Scheduling, drafting, summarizing and coordinating work are the first tasks AI assistants take on.' },
  { name: 'Executive Leadership', slug: 'executive-leadership', people: 'executives and senior leaders', blurb: 'Leaders are asked to set AI strategy, govern risk and lead change, not to build models.' },
]

const FUNCTION_BY_SLUG = new Map(CATALOG_FUNCTIONS.map((f) => [f.slug, f]))
const FUNCTION_BY_NAME = new Map(CATALOG_FUNCTIONS.map((f) => [f.name, f]))
export const catalogFunctionBySlug = (slug: string) => FUNCTION_BY_SLUG.get(slug) ?? null
export const catalogFunctionByName = (name: string) => FUNCTION_BY_NAME.get(name) ?? null

// A Course's `keywords` (function training) are lower-case words the Learning page matches against a member's function.
// This is the same idea in reverse: which function a keyword belongs to. Word-boundary patterns, so "hr" is not in "chrome".
const KEYWORD_FUNCTION: { fn: string; pattern: RegExp }[] = [
  { fn: 'Finance', pattern: /\b(financ\w*|accounting|treasury|credit|investment|portfolio|wealth|advis\w*|capital markets|fp&a)\b/ },
  { fn: 'Legal', pattern: /\b(legal|counsel|compliance|paralegal|contract|privacy)\b/ },
  { fn: 'Human Resources', pattern: /\b(human resources|hr|talent|recruit\w*|people)\b/ },
  { fn: 'Marketing', pattern: /\b(marketing|brand|growth)\b/ },
  { fn: 'Sales', pattern: /\b(sales|business development|revenue)\b/ },
  { fn: 'Operations', pattern: /\b(operations|supply chain|logistics)\b/ },
  { fn: 'Customer Success', pattern: /\b(customer (success|support|service))\b/ },
  { fn: 'Data & Analytics', pattern: /\b(data|analytics)\b/ },
  { fn: 'Product', pattern: /\b(product)\b/ },
  { fn: 'Design', pattern: /\b(design|ux)\b/ },
  { fn: 'Engineering', pattern: /\b(engineer\w*|developer|software)\b/ },
  { fn: 'Administration', pattern: /\b(administration|administrative|executive assistant)\b/ },
  { fn: 'Executive Leadership', pattern: /\b(executive|ceo|cfo|coo)\b/ },
]

/** The functions a course is for. A general AI course returns [] and shows under every function. */
export function functionsForCourse(c: { category: CourseCategory; keywords: string[]; targetFunctions: string[] }): string[] {
  const out = new Set<string>()
  if (c.category === 'FUNCTION_TRAINING') {
    for (const k of c.keywords) for (const r of KEYWORD_FUNCTION) if (r.pattern.test(k.toLowerCase())) out.add(r.fn)
  }
  if (c.category === 'CERTIFICATION') {
    for (const t of c.targetFunctions) if (FUNCTION_BY_NAME.has(t)) out.add(t)
  }
  return CATALOG_FUNCTIONS.map((f) => f.name).filter((n) => out.has(n))
}

export interface LevelInfo {
  level: CourseSkillLevel
  slug: 'beginner' | 'intermediate' | 'advanced'
  label: string
  /** Heading phrase: "AI courses for beginners". */
  heading: string
  /** Who this level is for, in plain words. */
  who: string
  /** What you can already do before you start. */
  before: string
  /** What you can do after. */
  after: string
}

export const LEVELS: LevelInfo[] = [
  {
    level: 'BEGINNER', slug: 'beginner', label: 'Beginner', heading: 'AI courses for beginners',
    who: 'You have tried an AI assistant a few times, or not at all, and want a safe, practical start.',
    before: 'Nothing. No coding and no earlier AI course.',
    after: 'Use an AI assistant for everyday work, write a clear prompt, and spot when its answer is wrong.',
  },
  {
    level: 'INTERMEDIATE', slug: 'intermediate', label: 'Intermediate', heading: 'Intermediate AI courses',
    who: 'You use an AI assistant most days and want to apply it to the real tasks of your own role.',
    before: 'You write your own prompts and have used AI on actual work.',
    after: 'Run multi-step workflows in your function, check the output the way a specialist would, and automate repeat tasks.',
  },
  {
    level: 'ADVANCED', slug: 'advanced', label: 'Advanced', heading: 'Advanced AI courses',
    who: 'You already work with AI tools in depth and want to lead AI work, design systems or govern risk in your field.',
    before: 'You have used AI tools for months and understand their limits.',
    after: 'Design AI workflows or agents, set policy and evaluation for your team, or lead an AI program.',
  },
]
const LEVEL_BY_SLUG = new Map(LEVELS.map((l) => [l.slug as string, l]))
const LEVEL_BY_ENUM = new Map(LEVELS.map((l) => [l.level, l]))
export const levelBySlug = (slug: string) => LEVEL_BY_SLUG.get(slug) ?? null
export const levelInfo = (level: CourseSkillLevel) => LEVEL_BY_ENUM.get(level)!
const LEVEL_ORDER: Record<CourseSkillLevel, number> = { BEGINNER: 0, INTERMEDIATE: 1, ADVANCED: 2 }

/** Beginner first, then free before paid, then title. The hub and every list sort this way. */
export function sortByLevel<T extends { level: CourseSkillLevel; free: boolean; title: string }>(courses: T[]): T[] {
  return [...courses].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || Number(b.free) - Number(a.free) || a.title.localeCompare(b.title))
}

/** A slug per course from its title, made unique across the catalog (no database column; stable while titles are). */
export function assignSlugs<T extends { title: string; sponsor: string; url: string }>(rows: T[]): (T & { slug: string })[] {
  const used = new Set<string>()
  return [...rows]
    .sort((a, b) => a.url.localeCompare(b.url))
    .map((r) => {
      const base = topicSlug(r.title).slice(0, 70) || 'course'
      let slug = base
      if (used.has(slug)) slug = `${base}-${topicSlug(r.sponsor).slice(0, 20)}`.slice(0, 90)
      for (let i = 2; used.has(slug); i++) slug = `${base}-${i}`
      used.add(slug)
      return { ...r, slug }
    })
}

export const sponsorSlug = (sponsor: string) => topicSlug(sponsor).slice(0, 60)

// Page paths. One place, so links, sitemap and canonicals can never disagree.
export const hubPath = () => AI_COURSES_PATH
export const levelPath = (l: LevelInfo) => `${AI_COURSES_PATH}/level/${l.slug}`
export const functionPath = (f: CatalogFunction) => `${AI_COURSES_PATH}/for/${f.slug}`
export const functionLevelPath = (f: CatalogFunction, l: LevelInfo) => `${AI_COURSES_PATH}/for/${f.slug}/${l.slug}`
export const sponsorPath = (sponsor: string) => `${AI_COURSES_PATH}/from/${sponsorSlug(sponsor)}`
export const coursePath = (c: { slug: string }) => `${AI_COURSES_PATH}/course/${c.slug}`
export const freePath = () => `${AI_COURSES_PATH}/free`

// A page is indexed only when it has enough of its own content to be worth a search result (the same idea as
// src/lib/seo/topic-quality.ts). Below the bar it still renders for visitors and is left out of the sitemap.
export const MIN_FUNCTION_COURSES = 2
export const MIN_SPONSOR_COURSES = 2

/** Courses for a function: those tagged to it, plus general AI courses when `withGeneral`. */
export function coursesForFunction(catalog: PublicCourse[], fn: string, opts: { withGeneral?: boolean; level?: CourseSkillLevel } = {}): PublicCourse[] {
  return sortByLevel(
    catalog.filter(
      (c) => (c.functions.includes(fn) || (opts.withGeneral && c.functions.length === 0 && c.category === 'AI_TRAINING')) && (!opts.level || c.level === opts.level),
    ),
  )
}

export function functionPageIndexable(catalog: PublicCourse[], fn: string): boolean {
  return coursesForFunction(catalog, fn).length >= MIN_FUNCTION_COURSES
}
export function functionLevelPageIndexable(catalog: PublicCourse[], fn: string, level: CourseSkillLevel): boolean {
  return coursesForFunction(catalog, fn, { level }).length >= MIN_FUNCTION_COURSES
}
export function sponsorCourses(catalog: PublicCourse[], slug: string): PublicCourse[] {
  return sortByLevel(catalog.filter((c) => sponsorSlug(c.sponsor) === slug))
}
export function sponsorPageIndexable(catalog: PublicCourse[], slug: string): boolean {
  return sponsorCourses(catalog, slug).length >= MIN_SPONSOR_COURSES
}

/** Courses that cover the same function and nearby levels, for "next course" links on a course page. */
export function relatedCourses(catalog: PublicCourse[], course: PublicCourse, limit = 4): PublicCourse[] {
  const score = (c: PublicCourse) =>
    (course.functions.length > 0 && c.functions.some((f) => course.functions.includes(f)) ? 3 : 0) +
    (c.sponsor === course.sponsor ? 1 : 0) -
    Math.abs(LEVEL_ORDER[c.level] - LEVEL_ORDER[course.level])
  return catalog
    .filter((c) => c.slug !== course.slug)
    .map((c) => ({ c, s: score(c) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.c.title.localeCompare(b.c.title))
    .slice(0, limit)
    .map((x) => x.c)
}

// The level quiz: four yes/no-style questions, each worth a point. Plain questions about what the person already does,
// not about what they know, so nobody has to guess at jargon.
export const LEVEL_QUESTIONS: { id: string; text: string }[] = [
  { id: 'use', text: 'Do you use an AI assistant (ChatGPT, Gemini, Claude, Copilot) at least weekly for real work?' },
  { id: 'prompt', text: 'Do you write your own detailed prompts and rework them when the answer is off?' },
  { id: 'workflow', text: 'Have you built a repeatable AI workflow, such as a saved prompt library, an automation or an AI agent?' },
  { id: 'lead', text: 'Have you set AI rules, evaluated AI output for a team, or led an AI project?' },
]

/** 0 yes answers or just the first: beginner. Two or three with the first two: intermediate. A workflow plus a lead answer: advanced. */
export function levelFromAnswers(yes: Record<string, boolean>): CourseSkillLevel {
  if (yes.lead && yes.workflow) return 'ADVANCED'
  if (yes.workflow || (yes.use && yes.prompt)) return 'INTERMEDIATE'
  return 'BEGINNER'
}
