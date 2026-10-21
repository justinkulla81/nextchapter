import { getCultureSurveyCompanies } from '@/lib/companies/culture-profile'
import { CultureSurveyPromptCard } from '@/components/companies/CultureSurvey'

// Dashboard: ask a member to describe one company they worked at (most recent former
// employer first, current employer last). One company at a time; nothing renders once
// they have described all of them, or when they are in Confidential Search Mode /
// STEALTH (getCultureSurveyCompanies returns nothing for them).
export async function CultureSurveyPrompt({ candidateId }: { candidateId: string }) {
  const companies = await getCultureSurveyCompanies(candidateId)
  const pending = companies.filter((c) => c.answers === null)
  if (pending.length === 0) return null
  const next = pending[0]
  return (
    <CultureSurveyPromptCard
      company={{ companyId: next.companyId, companyName: next.companyName, slug: next.slug, isCurrent: next.isCurrent }}
      moreCount={pending.length - 1}
    />
  )
}
