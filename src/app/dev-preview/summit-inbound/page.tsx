import { InboundView } from '@/components/talent-intake/InboundView'

// A firm's Inbound page with sample brand settings (Summit's teal, cream, editorial serif). Sample data only; never reachable in production.
export default function SummitInboundPreview() {
  return (
    <InboundView
      firm={{ name: 'Summit Search Consultants', slug: 'summit', logoUrl: null, brandHeroUrl: null, accentColor: '#283b41', brandFont: 'editorial', brandTone: 'cream' }}
      recruiter={null}
      recruiterSlug={null}
      notFit={false}
    />
  )
}
