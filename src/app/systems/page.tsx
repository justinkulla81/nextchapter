import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { isNcAdmin } from '@/lib/higher-ed/resolve'
import { prisma } from '@/lib/prisma'
import { systemsForEmail } from '@/lib/higher-ed/systems'

export const metadata = { title: 'College systems' }

// The systems this person can see: their own (by email), or all for a
// NextChapter admin.
export default async function SystemsIndex() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/login?next=/systems')
  const all = await isNcAdmin(user.id, user.email ?? null)
  const systems = all ? await prisma.institutionSystem.findMany({ orderBy: { name: 'asc' }, select: { slug: true, name: true } }) : await systemsForEmail(user.email ?? null)
  if (systems.length === 1 && !all) redirect(`/systems/${systems[0].slug}`)
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">College systems</h1>
      {systems.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {systems.map((s) => (
            <li key={s.slug}>
              <Link className="block p-4 font-medium hover:bg-muted" href={`/systems/${s.slug}`}>
                {s.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Your email isn’t on any college system. Ask NextChapter to add you, at support@launchyournextchapter.com.</p>
      )}
    </main>
  )
}
