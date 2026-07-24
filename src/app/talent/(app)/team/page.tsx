import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTalentDashboardData } from '@/lib/talent/get-talent-dashboard-data'
import { prisma } from '@/lib/prisma'
import { listAllAuthUsers, getAuthEmail } from '@/lib/admin/auth-users'
import { InviteSeatForm } from '@/components/talent/InviteSeatForm'
import { SubmitButton } from '@/components/ui/submit-button'
import { revokeSeat } from './actions'

export default async function TeamSeatsPage() {
  const employer = await getTalentDashboardData()

  // Seat management is owner-only — a seat member landing here (resolved
  // via resolveEmployerForUserId's owner-or-seat fallback in
  // getTalentDashboardData, which returns the same EmployerProfile row
  // either way) gets redirected rather than shown a page they can't act on,
  // since inviteSeat/revokeSeat both re-check ownership anyway.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || employer.userId !== user.id) {
    redirect('/talent')
  }

  const [seats, authUsers] = await Promise.all([
    prisma.employerSeat.findMany({ where: { employerId: employer.id }, orderBy: { invitedAt: 'desc' } }),
    listAllAuthUsers(),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="mt-1 text-muted-foreground">
          Invite teammates to share your roles, candidates, and hiring analytics.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4">
        <InviteSeatForm />
      </div>

      <div className="divide-y divide-border rounded-lg border border-border">
        <div className="flex items-center justify-between p-4">
          <div>
            <p className="font-medium text-foreground">{employer.contactName || 'You'}</p>
            <p className="text-sm text-muted-foreground">Owner</p>
          </div>
        </div>
        {seats.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No teammates invited yet.</p>
        ) : (
          seats.map((seat) => (
            <div key={seat.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium text-foreground">
                  {seat.userId ? getAuthEmail(authUsers, seat.userId) : seat.invitedEmail}
                </p>
                <p className="text-sm text-muted-foreground">
                  {seat.acceptedAt ? `Joined ${seat.acceptedAt.toLocaleDateString()}` : 'Invite pending'}
                </p>
              </div>
              <form action={revokeSeat.bind(null, seat.id)}>
                <SubmitButton pendingLabel="Removing…" variant="outline" size="sm">
                  {seat.acceptedAt ? 'Remove' : 'Cancel invite'}
                </SubmitButton>
              </form>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
