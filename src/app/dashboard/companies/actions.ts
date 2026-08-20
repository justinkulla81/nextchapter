'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCompany } from '@/lib/companies/company-lookup'

// Company pages are reachable from any job listing, matched job, or search
// (Prompt 3) — there's no single dedicated "browse all companies" index
// page. This is the shared resolve-and-navigate entry point used by every
// such link (Company Tracker today; a natural place to extend from later)
// so a company page always exists once a candidate clicks through, even if
// the nightly signals cron hasn't touched this specific company yet.
export async function goToCompanyPage(companyName: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const company = await getOrCreateCompany(companyName)
  redirect(`/dashboard/companies/${encodeURIComponent(company.canonicalNameNormalized)}`)
}
