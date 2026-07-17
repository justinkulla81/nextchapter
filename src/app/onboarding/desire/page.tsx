import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { DesireSlider } from '@/components/onboarding/DesireSlider'

export default async function DesirePage() {
  const profile = await getCandidateProfileForUser()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {profile.firstName ? `Hi ${profile.firstName}, everyone deserves a job` : 'Everyone deserves a job'}
        </h1>
        <p className="mt-1 text-muted-foreground">
          A job isn&apos;t just a paycheck — it&apos;s stability, purpose, and a way to build the
          life you want. You deserve one, full stop.
        </p>
      </div>

      <div className="space-y-2 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">But let&apos;s be honest about the market right now.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Median time unemployed is about 11 weeks; the average is closer to 24 weeks.</li>
          <li>Only about 7.6% of applications turn into an interview.</li>
        </ul>
        <p>
          This is a genuinely tough market. It rewards people who show up seriously and
          consistently — which is exactly what this platform is built to help you do.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-off-white p-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">How much do you want to get a job?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Be honest. This shapes how we build your plan — and yes, it factors into your
            Market Reality Grade.
          </p>
        </div>

        <DesireSlider defaultValue={profile.jobSearchIntensity} />
      </div>
    </div>
  )
}
