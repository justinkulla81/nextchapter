import type { Factor } from '@supabase/supabase-js'
import type { TwoStepFactor } from '@/components/admin/TwoStepLogin'

/** Verified TOTP factors as the two-step screen lists them, oldest first. */
export function factorRows(factors: Factor[]): TwoStepFactor[] {
  return [...factors]
    .filter((f) => f.status === 'verified')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((f, i) => ({
      id: f.id,
      name: f.friendly_name?.trim() || `Authenticator ${i + 1}`,
      added: new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }),
    }))
}
