import Link from 'next/link'
import { LINK } from '@/components/topics/blocks'
import { getRoleIndex } from '@/lib/seo/role-figures'
import { rolesForTitle } from '@/lib/seo/role-pages'

/** On a job-title or salary page whose title is a leadership role: a link to the role's page, which pools every spelling of the title. */
export async function RoleGuideLink({ title }: { title: string }) {
  const roles = rolesForTitle(title)
  if (roles.length === 0) return null
  const index = await getRoleIndex()
  const role = roles.find((r) => index.some((s) => s.slug === r.slug))
  if (!role) return null
  return (
    <p className="mt-8 max-w-3xl text-sm text-muted-foreground">
      {title} is one of the ways {role.spelled.toLowerCase()} is written. The <Link href={`/roles/${role.slug}`} className={LINK}>{role.name} role page</Link> counts every spelling together: pay, best industries and states, skills and AI skills.
    </p>
  )
}
