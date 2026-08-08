import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import {
  createEliteInstitution,
  toggleEliteInstitution,
  deleteEliteInstitution,
  createPrestigeEmployer,
  togglePrestigeEmployer,
  deletePrestigeEmployer,
  createHighDemandSignal,
  toggleHighDemandSignal,
  deleteHighDemandSignal,
} from './actions'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'

export default async function PedigreeSignalsAdminPage() {
  await requireAdmin()

  const [institutions, employers, signals] = await Promise.all([
    prisma.eliteInstitution.findMany({ orderBy: { name: 'asc' } }),
    prisma.prestigeEmployer.findMany({ orderBy: { name: 'asc' } }),
    prisma.highDemandSignal.findMany({ orderBy: { label: 'asc' } }),
  ])

  return (
    <div className="mx-auto max-w-3xl space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pedigree Signals</h1>
        <p className="mt-1 text-muted-foreground">
          Admin-curated lists that feed a Target Fit bonus for candidates with a matching university, employer, or
          high-demand function on file — plus a promotion-velocity read computed automatically from work history.
          See <code>src/lib/scoring/pedigree-bonus.ts</code>. For the rare, obviously-exceptional profile that
          should skip the normal weekly-activity requirement entirely, use the Exceptional Profile override on that
          candidate&apos;s detail page instead of relying on this bonus alone.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Elite Institutions</h2>
        <form action={createEliteInstitution} className="flex items-end gap-3">
          <div className="flex-1 space-y-2">
            <Label htmlFor="institutionName">School name</Label>
            <Input id="institutionName" name="name" placeholder="Harvard University" required />
          </div>
          <SubmitButton>Add</SubmitButton>
        </form>
        <div className="space-y-2">
          {institutions.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <span className={item.isActive ? '' : 'text-muted-foreground line-through'}>{item.name}</span>
                <div className="flex gap-1.5">
                  <form action={toggleEliteInstitution.bind(null, item.id, item.isActive)}>
                    <SubmitButton variant="ghost" size="sm">
                      {item.isActive ? 'Deactivate' : 'Activate'}
                    </SubmitButton>
                  </form>
                  <form action={deleteEliteInstitution.bind(null, item.id)}>
                    <SubmitButton variant="ghost" size="sm">
                      Delete
                    </SubmitButton>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Prestige Employers</h2>
        <form action={createPrestigeEmployer} className="flex items-end gap-3">
          <div className="flex-1 space-y-2">
            <Label htmlFor="employerName">Company name</Label>
            <Input id="employerName" name="name" placeholder="Google" required />
          </div>
          <SubmitButton>Add</SubmitButton>
        </form>
        <div className="space-y-2">
          {employers.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <span className={item.isActive ? '' : 'text-muted-foreground line-through'}>{item.name}</span>
                <div className="flex gap-1.5">
                  <form action={togglePrestigeEmployer.bind(null, item.id, item.isActive)}>
                    <SubmitButton variant="ghost" size="sm">
                      {item.isActive ? 'Deactivate' : 'Activate'}
                    </SubmitButton>
                  </form>
                  <form action={deletePrestigeEmployer.bind(null, item.id)}>
                    <SubmitButton variant="ghost" size="sm">
                      Delete
                    </SubmitButton>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">High-Demand Functions/Industries</h2>
        <form action={createHighDemandSignal} className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="signalLabel">Label</Label>
              <Input id="signalLabel" name="label" placeholder="Chief AI Officer" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signalCategory">Category</Label>
              <select
                id="signalCategory"
                name="category"
                required
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="FUNCTION">Function</option>
                <option value="INDUSTRY">Industry</option>
                <option value="ROLE_TITLE">Role title</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="signalKeywords">Match keywords (comma-separated)</Label>
            <Input id="signalKeywords" name="keywords" placeholder="chief ai officer, head of ai, ai/ml leadership" required />
          </div>
          <SubmitButton className="w-fit">Add</SubmitButton>
        </form>
        <div className="space-y-2">
          {signals.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <div className={item.isActive ? '' : 'text-muted-foreground line-through'}>
                  <span className="font-medium">{item.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {item.category} — {item.keywords.join(', ')}
                  </span>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <form action={toggleHighDemandSignal.bind(null, item.id, item.isActive)}>
                    <SubmitButton variant="ghost" size="sm">
                      {item.isActive ? 'Deactivate' : 'Activate'}
                    </SubmitButton>
                  </form>
                  <form action={deleteHighDemandSignal.bind(null, item.id)}>
                    <SubmitButton variant="ghost" size="sm">
                      Delete
                    </SubmitButton>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
