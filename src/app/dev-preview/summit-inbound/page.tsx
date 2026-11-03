import { InboundView } from '@/components/talent-intake/InboundView'

// A firm's Inbound page two ways: with Summit's sample brand settings, and with none set (NextChapter's own look).
// Sample data only; never reachable in production.
export default function SummitInboundPreview({ searchParams }: { searchParams: Promise<{ brand?: string }> }) {
  return <Preview searchParams={searchParams} />
}

async function Preview({ searchParams }: { searchParams: Promise<{ brand?: string }> }) {
  const { brand } = await searchParams
  const summit = brand !== 'none'
  return (
    <InboundView
      firm={{ name: 'Summit Search Consultants', slug: 'summit', logoUrl: null, brandHeroUrl: null, accentColor: summit ? '#283b41' : null, brandFont: summit ? 'editorial' : null, brandTone: summit ? 'cream' : null }}
      recruiter={null}
      recruiterSlug={null}
      notFit={false}
    />
  )
}
