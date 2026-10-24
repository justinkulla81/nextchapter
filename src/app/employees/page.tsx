import type { Metadata } from 'next'
import { PortalMarketingPage } from '@/components/marketing/PortalMarketingPage'
import { EMPLOYEES } from '@/lib/marketing/portal-pages/employees'
import { portalMetadata } from '@/lib/marketing/portal-seo'

export const metadata: Metadata = portalMetadata(EMPLOYEES.seo)

export default function EmployeesPage() {
  return <PortalMarketingPage content={EMPLOYEES.content} />
}
