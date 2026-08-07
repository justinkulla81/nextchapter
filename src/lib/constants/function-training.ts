// lastVerified: 2026-07-29 — re-check every URL before merging Learning-
// page UI work on top of this file.
//
// Function-specific training courses (distinct from ai-tools-by-function.ts's
// AI *tools*) — same keyword-matching pattern, same shared keyword arrays
// (imported from match-by-function.ts) so the two files can never
// disagree about which candidates see which content.
import {
  matchByFunction,
  SALES_KEYWORDS,
  DESIGN_KEYWORDS,
  CUSTOMER_SUCCESS_KEYWORDS,
  DATA_ANALYTICS_KEYWORDS,
  EXECUTIVE_LEADERSHIP_KEYWORDS,
  ADMINISTRATION_KEYWORDS,
} from '@/lib/constants/match-by-function'
import type { LearningResource } from '@/lib/constants/learning-partners'

const FUNCTION_TRAINING_BY_KEYWORD: { keywords: string[]; courses: LearningResource[] }[] = [
  {
    keywords: ['finance', 'accounting', 'cfo', 'controller', 'fp&a'],
    courses: [
      { title: 'Business and Financial Modeling Specialization', sponsor: 'Wharton', description: 'A specialization on building real financial models.', url: 'https://www.coursera.org/specializations/wharton-finance', provider: 'coursera', free: false, actionType: 'LEARNING_MODULE' },
    ],
  },
  {
    keywords: ['marketing', 'brand', 'growth', 'demand'],
    courses: [
      { title: 'Digital Marketing Specialization', sponsor: 'University of Illinois', description: 'A specialization covering the full digital-marketing toolkit.', url: 'https://www.coursera.org/specializations/digital-marketing', provider: 'coursera', free: false, actionType: 'LEARNING_MODULE' },
      { title: 'HubSpot Academy: Digital Marketing Course', sponsor: 'HubSpot', description: 'A free, widely recognized digital-marketing fundamentals course.', url: 'https://academy.hubspot.com/courses/digital-marketing', provider: 'hubspotAcademy', free: true, actionType: 'LEARNING_MODULE' },
    ],
  },
  {
    keywords: SALES_KEYWORDS,
    courses: [
      { title: 'Sales Operations/Management Specialization', sponsor: 'West Virginia University', description: 'A specialization on the sales-ops and management fundamentals.', url: 'https://www.coursera.org/specializations/sales-operations', provider: 'coursera', free: false, actionType: 'LEARNING_MODULE' },
    ],
  },
  {
    keywords: ['engineer', 'developer', 'software', 'technical'],
    courses: [
      { title: 'IBM Full Stack Software Developer Professional Certificate', sponsor: 'IBM', description: 'A practical, project-based full-stack development certificate.', url: 'https://www.coursera.org/professional-certificates/ibm-full-stack-cloud-developer', provider: 'coursera', free: false, actionType: 'LEARNING_MODULE' },
      { title: "CS50x: Introduction to Computer Science", sponsor: 'Harvard', description: "A free-to-audit foundational computer-science course.", url: 'https://www.edx.org/learn/computer-science/harvard-university-cs50-s-introduction-to-computer-science', provider: 'edx', free: true, actionType: 'LEARNING_MODULE' },
    ],
  },
  {
    keywords: ['human resources', 'hr', 'talent', 'recruit', 'people'],
    courses: [
      { title: 'Human Resource Management Specialization', sponsor: 'University of Minnesota', description: 'A specialization covering the core HR management disciplines.', url: 'https://www.coursera.org/specializations/human-resource-management', provider: 'coursera', free: false, actionType: 'LEARNING_MODULE' },
    ],
  },
  {
    keywords: ['operations', 'supply chain', 'logistics'],
    courses: [
      { title: 'Supply Chain Management Specialization', sponsor: 'Rutgers', description: 'A specialization on core supply-chain and operations fundamentals.', url: 'https://www.coursera.org/specializations/supply-chain-management', provider: 'coursera', free: false, actionType: 'LEARNING_MODULE' },
    ],
  },
  {
    keywords: ['legal', 'counsel', 'compliance'],
    courses: [
      { title: 'Contract Law Specialization', sponsor: 'Wesleyan University', description: 'A course on the fundamentals of contract law.', url: 'https://www.coursera.org/learn/contract-law', provider: 'coursera', free: false, actionType: 'LEARNING_MODULE' },
    ],
  },
  {
    keywords: DESIGN_KEYWORDS,
    courses: [
      { title: 'Google UX Design Professional Certificate', sponsor: 'Google', description: 'Also listed under Certifications — the same program, a full practical UX training path.', url: 'https://www.coursera.org/professional-certificates/google-ux-design', provider: 'coursera', free: false, actionType: 'LEARNING_MODULE' },
    ],
  },
  {
    keywords: CUSTOMER_SUCCESS_KEYWORDS,
    courses: [
      { title: 'Customer Success Specialization', sponsor: 'Coursera', description: "Practical training on onboarding, retention, and expansion fundamentals.", url: 'https://www.coursera.org/specializations/customer-success', provider: 'coursera', free: false, actionType: 'LEARNING_MODULE' },
    ],
  },
  {
    keywords: DATA_ANALYTICS_KEYWORDS,
    courses: [
      { title: 'Google Data Analytics Professional Certificate', sponsor: 'Google', description: 'Also listed under Certifications — the same program, a full practical analytics training path.', url: 'https://www.coursera.org/professional-certificates/google-data-analytics', provider: 'coursera', free: false, actionType: 'LEARNING_MODULE' },
    ],
  },
  {
    keywords: EXECUTIVE_LEADERSHIP_KEYWORDS,
    courses: [
      { title: 'High Performance Collaboration: Leadership, Teamwork, and Negotiation', sponsor: 'Northwestern', description: "A course on leading at the executive level.", url: 'https://www.coursera.org/learn/negotiation-skills', provider: 'coursera', free: false, actionType: 'LEARNING_MODULE' },
    ],
  },
  {
    keywords: ADMINISTRATION_KEYWORDS,
    courses: [
      { title: 'Workplace Communication for Administrative Professionals', sponsor: 'Coursera', description: 'Practical training on the core administrative-support skill set.', url: 'https://www.coursera.org/learn/workplace-communication', provider: 'coursera', free: false, actionType: 'LEARNING_MODULE' },
    ],
  },
]

export function getFunctionTraining(primaryFunction: string | null): LearningResource[] {
  return (
    matchByFunction(primaryFunction, FUNCTION_TRAINING_BY_KEYWORD.map((g) => ({ keywords: g.keywords, value: g.courses }))) ?? []
  )
}

// Every function-training course across every function, regardless of the
// candidate's own function — used by the email completion-detection
// matcher, which needs to recognize a title no matter who took the course.
export function getAllFunctionTrainingCourses(): LearningResource[] {
  return FUNCTION_TRAINING_BY_KEYWORD.flatMap((g) => g.courses)
}
