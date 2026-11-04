import { SeoPage, H2, ActionBand } from '@/components/seo/SeoPage'
import { FirmInterestPanel } from '@/components/search-firms/FirmInterestPanel'
import { readableOn } from '@/lib/recruiter/brand'

// Preview of a search firm's public page with sample data (the real page is src/app/search-firms/[slug]). Not reachable in production.
export const dynamic = 'force-dynamic'

export default function FirmPagePreview() {
  const accent = '#283b41'
  return (
    <SeoPage
      look="audience"
      trail={[{ name: 'Search firms', path: '/search-firms' }, { name: 'Summit Search Consultants', path: '/search-firms/summit-search' }]}
      h1="Summit Search Consultants: open searches and specialties"
      brand={{ color: accent, ink: readableOn(accent) }}
      lede={
        <>
          <span className="block text-sm opacity-90">Search firm</span>
          At Summit Search Consultants, we specialize in retained executive search for advanced technology companies, including MedTech, AI and SaaS, across corporate, PE and VC environments. We offer tailored placements for C-Suite, VP and Director-level roles, ensuring the right leadership to accelerate your business growth.
          <span className="mt-3 block text-sm">
            <a href="https://summitsearchconsultants.com" className="font-semibold underline underline-offset-4">Visit Summit Search Consultants&apos; website</a>
            <span className="opacity-80"> · description from its site</span>
          </span>
        </>
      }
    >
      <FirmInterestPanel orgId="sample" firmName="Summit Search Consultants" accent={accent} inboundSlug={null} />
      <p className="mt-10 max-w-3xl text-sm text-muted-foreground">No searches with a public listing right now. This page updates when the firm lists roles.</p>
      <ActionBand title="Run recruiting at Summit Search Consultants?" body="Claim this page and set up a free workspace for Summit Search Consultants. Use a work email at your firm’s domain." label="Claim this page" href="/prepared/summit-search" event="search_firm_claim_clicked" properties={{ page: 'preview' }} />
      <h2 className={H2 + ' sr-only'}>end</h2>
    </SeoPage>
  )
}
