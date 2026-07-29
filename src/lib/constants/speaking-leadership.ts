// lastVerified: 2026-07-29 — re-check every URL before merging Learning-
// page UI work on top of this file.
//
// Toastmasters (Included for quality, no revenue relationship) + one
// Coursera public-speaking specialization, always shown, plus a
// leadership-gated set shown only when hasManagementSignal is true. No
// sales-training.ts equivalent exists in this file or anywhere else in
// the Learning content — deliberately absent, no vendor identified.
import type { LearningResource } from '@/lib/constants/learning-partners'

export const SPEAKING_RESOURCES: LearningResource[] = [
  {
    title: 'Toastmasters International',
    description: 'The most established public-speaking practice community — local clubs meet weekly.',
    url: 'https://www.toastmasters.org/',
    provider: 'toastmasters',
    free: false,
    actionType: 'LEARNING_MODULE',
  },
  {
    title: 'Dynamic Public Speaking Specialization',
    description: "University of Washington's specialization on structuring and delivering a talk.",
    url: 'https://www.coursera.org/specializations/public-speaking',
    provider: 'coursera',
    free: false,
    actionType: 'LEARNING_MODULE',
  },
]

export const SPEAKING_LEADERSHIP_GATED: LearningResource[] = [
  {
    title: 'Inspiring Leadership through Emotional Intelligence',
    description: "Case Western's widely-taken course on leadership presence and self-awareness.",
    url: 'https://www.coursera.org/learn/emotional-intelligence-leadership',
    provider: 'coursera',
    free: false,
    actionType: 'LEARNING_MODULE',
  },
  {
    title: 'Leadership Communication for Maximum Impact: Storytelling',
    description: "Notre Dame's course on communicating as a leader through narrative and story structure.",
    url: 'https://www.edx.org/learn/business-storytelling/university-of-notre-dame-leadership-communication-for-maximum-impact-storytelling',
    provider: 'edx',
    free: false,
    actionType: 'LEARNING_MODULE',
  },
]
