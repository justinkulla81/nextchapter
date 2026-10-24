import type { PortalSeo } from '@/lib/marketing/portal-seo'

// /for-organizations: the hub. One card per portal (src/lib/marketing/portals.ts) linking to its page and its log in.
// The headline says what the page is and does not promise anything that is not true for every portal: outplacement is
// contract-based, and employers, coaches and recruiter firms are followed up by our team.

export const HUB_PATH = '/for-organizations'

export const HUB_SEO: PortalSeo = {
  title: 'NextChapter for organizations',
  description:
    'Portals for colleges, workforce organizations, employers, recruiters and coaches. Each has its own page, its own plans and its own log in.',
  path: HUB_PATH,
}

export const HUB_COPY = {
  eyebrow: 'For organizations',
  headline: 'A workspace for every organization that helps people get hired',
  subhead:
    'Colleges, workforce organizations, employers, recruiters and coaches each have their own portal, page and plans. Job seekers use the core tools without paying.',
  primary: { label: 'Talk to us', href: '#contact' },
  primaryNote: 'Not sure which fits? Tell us what you are trying to do.',
  portalsHeading: 'Choose your portal',
  portalsIntro: 'Each card says who the portal is for, what you get and how you start. Every card links to the portal’s page and its log in.',
  contactTitle: 'Talk to us',
  contactIntro: 'Tell us what you are trying to do and which portal you think fits. The data behind the platform is in the monthly White Collar Employment Report.',
  contactForm: { audience: 'ORGANIZATION' as const, source: 'organizations', heading: 'Send us a message' },
  extraLinks: [
    { href: '/nonprofits', label: 'Nonprofits and community organizations' },
    { href: '/employers', label: 'Employers: all three sections' },
    { href: '/pricing', label: 'Plans' },
  ],
  trail: [{ name: 'For organizations', path: HUB_PATH }],
  jsonLdDescription: 'Portals for colleges, workforce organizations, employers, recruiters and coaches, each with its own page, plans and log in.',
}
