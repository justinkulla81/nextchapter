import { requireAdmin } from '@/lib/admin/auth'
import { getCoachingSettings } from '@/lib/admin/coaching-settings'
import { saveCoachingSettings } from './actions'
import { CoachingSettingsForm } from '@/components/admin/CoachingSettingsForm'

export default async function CoachingSettingsAdminPage() {
  await requireAdmin()
  const settings = await getCoachingSettings()

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Coaching settings</h1>
        <p className="mt-1 text-muted-foreground">
          Coaching operations policy — Master Build Script §A5.3. Every field here is configuration, not code: this
          is the one active settings row the app reads, updated in place, with every change logged (actor and
          timestamp) to the admin settings change log.
        </p>
      </div>
      <CoachingSettingsForm action={saveCoachingSettings} existing={settings} />
    </div>
  )
}
