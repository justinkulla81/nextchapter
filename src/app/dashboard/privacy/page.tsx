import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { PrivacyTierSelector } from '@/components/candidates/PrivacyTierSelector'
import { ActionWindowSelector } from '@/components/dashboard/ActionWindowSelector'
import { DeleteAccountForm } from '@/components/dashboard/DeleteAccountForm'

export default async function PrivacyPage() {
  const profile = await getDashboardData()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Privacy</h1>
        <p className="mt-1 text-muted-foreground">
          Control exactly what employers can see about you, and when.
        </p>
      </div>
      <PrivacyTierSelector currentTier={profile.privacyTier} />

      <div className="space-y-3 border-t border-border pt-8">
        <h2 className="text-lg font-semibold">Notifications</h2>
        <ActionWindowSelector current={profile.actionWindow} />
      </div>

      <div className="space-y-3 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold text-destructive">Danger zone</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Permanently delete your account and all associated data.
          </p>
        </div>
        <DeleteAccountForm />
      </div>
    </div>
  )
}
