import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { brandStyle, mergeBrand } from '@/lib/partners/brand'
import { PartnerBrandMark } from '@/components/partners/PartnerBrandMark'
import { FrontDoorPortals, type FrontDoorItem } from '@/components/partners/FrontDoorPortals'
import { portalLinks } from '@/lib/organizations/front-door'
import { demoTargets } from '@/lib/demo/access'
import { portalMeta, type PortalType } from '@/lib/organizations/portals'

// A customer's front door: their name, logo and colors, and one card per portal
// they own. Public. It holds no customer data. A demo is open to anyone but is
// marked as a demo on every screen.

async function load(slug: string) {
  const org = await prisma.organization.findUnique({ where: { slug }, include: { workspaces: { where: { status: 'ACTIVE' } } } })
  if (!org) return null
  if (org.isDemo && org.demoExpiresAt && org.demoExpiresAt < new Date()) return null
  return org
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const org = await load((await params).slug)
  const name = org?.brandName ?? org?.name
  return { title: name ? `${name} on NextChapter` : 'NextChapter', robots: { index: false, follow: false } }
}

export default async function FrontDoorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const org = await load(slug)
  if (!org) notFound()

  const brand = mergeBrand({ name: org.brandName ?? org.name, logoUrl: org.logoUrl, accent: org.accentColor, secondary: org.secondaryColor, background: org.backgroundColor })
  const name = brand.name ?? org.name
  const owned = org.workspaces.filter((w) => w.refId || w.type === 'HIGHER_ED').map((w) => w.type as PortalType)

  const items: FrontDoorItem[] = org.isDemo
    ? demoTargets(org, org.workspaces).map((t) => {
        const role = t.label.includes(', as ') ? t.label.split(', as ')[1] : t.label.replace(/ \(.*\)$/, '').toLowerCase()
        return { key: t.key, title: t.label.replace(/ \(.*\)$/, ''), blurb: portalMeta(t.type).blurb, demo: true, actionLabel: `Explore as ${role}` }
      })
    : portalLinks(slug, owned).map((l) => ({ key: l.type, title: l.label, blurb: l.blurb, href: l.href, actionLabel: `Sign in to ${l.label.toLowerCase()}` }))

  return (
    <div className="theme-partner min-h-screen" style={brandStyle(brand)}>
      {org.isDemo && (
        <div role="note" className="bg-warn/25 px-4 py-2 text-center text-sm font-medium text-foreground">
          Demo. Everything here is sample data, and nothing you do is real.
        </div>
      )}
      <header className="bg-navy px-4 py-3 text-white lg:px-6" style={brand.accent ? { boxShadow: `inset 0 -3px 0 ${brand.accent}` } : undefined}>
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <PartnerBrandMark brand={brand} />
          <span className="text-base font-semibold">{name}</span>
          {org.isDemo && <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-medium">Demo</span>}
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-12 lg:px-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{org.isDemo ? `${name} demo` : `Welcome to ${name}`}</h1>
          <p className="max-w-2xl text-muted-foreground">
            {org.isDemo ? 'Pick a role to see what each person in the program sees, with sample data.' : 'Choose where you want to go. Each portal has its own sign-in.'}
          </p>
        </div>
        <FrontDoorPortals slug={slug} items={items} />
        <p className="text-xs text-muted-foreground">Powered by NextChapter</p>
      </main>
    </div>
  )
}
