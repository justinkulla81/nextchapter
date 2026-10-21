import { Suspense } from 'react'
import Link from 'next/link'
import { headers } from 'next/headers'
import { Landmark } from 'lucide-react'
import { PortalAuthCard } from '@/components/auth/PortalAuthCard'
import { LoginForm } from '@/components/auth/LoginForm'
import { safeNext } from '@/lib/auth/safe-next'
import { NOINDEX } from '@/lib/seo/canonical'
import { prisma } from '@/lib/prisma'
import { getOrgUser, getSessionAal } from '@/lib/supabase/get-current-user'
import { isNcAdmin } from '@/lib/higher-ed/resolve'
import { orgHostKindOf } from '@/lib/higher-ed/workspaces'
import { ORG_SUBDOMAINS_ON, mainOrigin, orgAppUrl, orgKindForHost } from '@/lib/org-hosts'

export const metadata = NOINDEX

// Sign-in for college and workforce portals, with its own session cookie
// (and, with org subdomains on, its own host). Signed in already: the
// portals this login opens.
export default async function OrgLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  const hostKind = orgKindForHost((await headers()).get('host'))
  const user = await getOrgUser()
  if (user && !next) {
    const aal = await getSessionAal('org')
    const admin = await isNcAdmin(user.id, user.email ?? null, undefined, aal)
    // A NextChapter admin whose session hasn't done two-step login yet (only
    // when ADMIN_MFA_REQUIRED is on): their admin access waits for it.
    const adminNeedsTwoStep = !admin && aal !== 'aal2' && (await isNcAdmin(user.id, user.email ?? null, undefined, 'aal2'))
    const rows = await prisma.institution.findMany({
      where: admin
        ? hostKind
          ? { orgType: hostKind === 'workforce' ? { not: 'COLLEGE' } : 'COLLEGE' }
          : {}
        : {
            OR: [
              { users: { some: { userId: user.id, revokedAt: null } } },
              { members: { some: { candidate: { userId: user.id } } } },
              { employers: { some: { status: 'APPROVED', employerProfile: { userId: user.id } } } },
            ],
          },
      orderBy: [{ isDemo: 'asc' }, { name: 'asc' }],
      take: 60,
      select: { slug: true, name: true, orgType: true, isDemo: true },
    })
    return (
      <PortalAuthCard icon={Landmark} portalLabel="Colleges and workforce partners" title="Your portals" description={`Signed in as ${user.email}.`}>
        {adminNeedsTwoStep && (
          <p className="mb-3 rounded-md bg-muted px-3 py-2 text-sm">
            Your NextChapter admin access needs two-step login first.{' '}
            <a href={ORG_SUBDOMAINS_ON ? '/mfa' : '/i/mfa'} className="font-medium text-primary underline underline-offset-4">Enter your code</a>
          </p>
        )}
        {rows.length ? (
          <ul className="divide-y divide-border text-sm">
            {rows.map((r) => (
              <li key={r.slug} className="flex items-center justify-between py-2">
                <a href={orgAppUrl(r.slug, orgHostKindOf(r.orgType))} className="font-medium text-primary hover:underline">
                  {r.name}
                </a>
                {r.isDemo && <span className="text-xs text-muted-foreground">Demo</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">This login doesn&apos;t open any portal yet. If you were invited, open the link in your email.</p>
        )}
      </PortalAuthCard>
    )
  }
  const dest = safeNext(next, '/')
  return (
    <PortalAuthCard
      icon={Landmark}
      portalLabel="Colleges and workforce partners"
      title="Log in"
      description={ORG_SUBDOMAINS_ON ? 'Staff, partners, member companies and people in a program. Use your NextChapter email and password.' : 'For staff, member companies and partners.'}
    >
      <Suspense>
        <LoginForm defaultNext={ORG_SUBDOMAINS_ON ? "/login" : "/i/login"} forgotPasswordHref={`${mainOrigin()}/auth/forgot-password`} signupHref={null} showGoogle={false} portal="org" />
      </Suspense>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        {ORG_SUBDOMAINS_ON ? (
          <>
            Looking for your NextChapter dashboard?{' '}
            <a href={`${mainOrigin()}/dashboard`} className="font-medium text-primary hover:underline">
              Go to the main site
            </a>
          </>
        ) : (
          <>
            Job seeker or alum?{' '}
            <Link href={`/auth/login?next=${encodeURIComponent(dest)}`} className="font-medium text-primary hover:underline">
              Log in here
            </Link>
          </>
        )}
      </p>
    </PortalAuthCard>
  )
}
