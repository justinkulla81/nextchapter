// lastVerified: 2026-07-29 — re-check every URL before merging Learning-
// page UI work on top of this file.
//
// General business-skills courses (shown to everyone) plus a
// leadership-gated set (shown only when hasManagementSignal is true —
// see build-learning-plan.ts in Phase 8) plus one single Emeritus catalog
// card. Emeritus appears exactly once as a catalog-level link, not a grid
// of individual courses, so it doesn't take visual weight away from the
// two real partners (Coursera/edX).
import type { LearningResource } from '@/lib/constants/learning-partners'

export const BUSINESS_SKILLS_GENERAL: LearningResource[] = [
  {
    title: 'Business Foundations Specialization',
    description: "Wharton's specialization covering the core disciplines — finance, marketing, operations, strategy.",
    url: 'https://www.coursera.org/specializations/wharton-business-foundations',
    provider: 'coursera',
    free: false,
    actionType: 'LEARNING_MODULE',
  },
  {
    title: 'Successful Negotiation: Essential Strategies and Skills',
    description: "Michigan's widely-taken course on negotiation fundamentals.",
    url: 'https://www.coursera.org/learn/negotiation-skills',
    provider: 'coursera',
    free: false,
    actionType: 'LEARNING_MODULE',
  },
  {
    title: 'Finance for Everyone',
    description: "McMaster's accessible introduction to core financial concepts for non-finance roles.",
    url: 'https://www.coursera.org/specializations/finance-for-everyone',
    provider: 'coursera',
    free: false,
    actionType: 'LEARNING_MODULE',
  },
  {
    title: 'Project Management Principles and Practices',
    description: "UC Irvine's specialization covering core project-management fundamentals.",
    url: 'https://www.coursera.org/specializations/project-management',
    provider: 'coursera',
    free: false,
    actionType: 'LEARNING_MODULE',
  },
]

export const BUSINESS_SKILLS_LEADERSHIP: LearningResource[] = [
  {
    title: 'Strategic Leadership and Management Specialization',
    description: "Illinois's specialization on leading teams and organizations strategically.",
    url: 'https://www.coursera.org/specializations/strategic-leadership',
    provider: 'coursera',
    free: false,
    actionType: 'LEARNING_MODULE',
  },
  {
    title: 'Leading People and Teams Specialization',
    description: "Michigan's specialization on the practical skills of managing and motivating people.",
    url: 'https://www.coursera.org/specializations/leading-teams',
    provider: 'coursera',
    free: false,
    actionType: 'LEARNING_MODULE',
  },
  {
    title: 'People Analytics',
    description: "Wharton's course on using data to make better people-management decisions.",
    url: 'https://www.coursera.org/learn/wharton-people-analytics',
    provider: 'coursera',
    free: false,
    actionType: 'LEARNING_MODULE',
  },
]

export const EMERITUS_CATALOG: LearningResource = {
  title: 'Emeritus executive certificate catalog',
  description: 'University-branded executive certificate programs delivered online — a broader, paid catalog worth browsing if you want something more structured than a single course.',
  url: 'https://emeritus.org/',
  provider: 'emeritus',
  free: false,
  actionType: 'LEARNING_CERTIFICATE',
}
