// Free things an organization can get from a partner page without talking to anyone. Each one is something that already
// exists on the site, so the offer is delivered the moment it is asked for. An asset with `gated: true` asks for a work
// email and an organization first and files the person in the CRM; the others are a plain link.

export type B2bAssetKey = 'outplacement-rfp-kit' | 'workforce-demo'

export interface B2bAsset {
  key: B2bAssetKey
  /** The offer, as a heading. */
  label: string
  /** What they get and why it matters, in one or two sentences. */
  blurb: string
  /** Where the asset lives. */
  href: string
  /** The button that opens it. */
  openLabel: string
  /** The button on the form (gated assets only). */
  requestLabel: string
  gated: boolean
}

export const B2B_ASSETS: Record<B2bAssetKey, B2bAsset> = {
  'outplacement-rfp-kit': {
    key: 'outplacement-rfp-kit',
    label: 'Outplacement RFP template and vendor scorecard',
    blurb: 'The eight questions to put to every outplacement vendor, and a scoring sheet to compare the answers side by side. Use it for any provider, ours included.',
    href: '/rfp-template',
    openLabel: 'Open the template',
    requestLabel: 'Get the template',
    gated: true,
  },
  'workforce-demo': {
    key: 'workforce-demo',
    label: 'See your region’s workspace in 60 seconds',
    blurb: 'Pick your state or area and get a working demo built on real local job and training data. No call, no sales form.',
    href: '/demo/workforce',
    openLabel: 'Build my region’s demo',
    requestLabel: 'Build my region’s demo',
    gated: false,
  },
}

export const isB2bAssetKey = (v: string): v is B2bAssetKey => v in B2B_ASSETS
