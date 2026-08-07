import 'server-only'
import { AI_TRAINING_COURSES } from '@/lib/constants/ai-training-tiers'
import { BUSINESS_SKILLS_GENERAL, BUSINESS_SKILLS_LEADERSHIP } from '@/lib/constants/business-skills-learning'
import { getAllFunctionTrainingCourses } from '@/lib/constants/function-training'
import { CERTIFICATIONS_BY_FUNCTION } from '@/lib/constants/certifications-by-function'
import { SPEAKING_RESOURCES, SPEAKING_LEADERSHIP_GATED } from '@/lib/constants/speaking-leadership'

// Every course/certification title in the static catalog, regardless of
// which candidate would actually be shown it — used only by the email
// completion-detection matcher (sync-gmail.ts), which needs to recognize a
// title in a "you completed X" email no matter who took the course.
// Exec-ed-by-school programs are deliberately excluded: those are
// alumni-specific programs unlikely to send this kind of completion email
// in the first place, not worth the extra import surface for this feature.
export function getAllCatalogTitles(): string[] {
  const titles = [
    ...Object.values(AI_TRAINING_COURSES).flat(),
    ...BUSINESS_SKILLS_GENERAL,
    ...BUSINESS_SKILLS_LEADERSHIP,
    ...getAllFunctionTrainingCourses(),
    ...Object.values(CERTIFICATIONS_BY_FUNCTION).flat(),
    ...SPEAKING_RESOURCES,
    ...SPEAKING_LEADERSHIP_GATED,
  ].map((item) => item.title)
  return Array.from(new Set(titles))
}
