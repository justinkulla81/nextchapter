import { loadCompanyIntelPanels } from '@/lib/companies/company-intel-data'
import { CompanyIntelPanelsView } from '@/components/companies/CompanyIntelPanelsView'

// Loads the company's intel panels and renders them; the markup lives in CompanyIntelPanelsView so the dev-preview can
// render it with sample data. `redesign` shows the same facts as plain sections.
export async function CompanyIntelPanels({ companyId, redesign = false }: { companyId: string; redesign?: boolean }) {
  const d = await loadCompanyIntelPanels(companyId)
  return <CompanyIntelPanelsView d={d} redesign={redesign} />
}
