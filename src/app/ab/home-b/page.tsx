import type { Metadata } from 'next'
import { NewHome } from '@/components/home/NewHome'
import { canonical } from '@/lib/seo/canonical'
import { FreshLinks } from '@/components/marketing/FreshLinks'

// Variant B of the homepage test (src/lib/home-ab.ts). Reached only through the proxy's rewrite from "/", so the visible
// address is "/". Opened directly it is noindex with the homepage as its canonical, and it is in no sitemap.
export const revalidate = 300

export const metadata: Metadata = {
  ...canonical('/'),
  robots: { index: false, follow: true },
}

export default function HomeVariantB() {
  return <NewHome variant="picker" fresh={<FreshLinks tone="dark" placement="home_b" />} />
}
