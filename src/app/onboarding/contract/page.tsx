import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { ContractChoice } from '@/components/onboarding/ContractChoice'
import { VictoriaAvatar } from '@/components/VictoriaAvatar'

export default async function ContractPage() {
  await getCandidateProfileForUser()

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="max-w-2xl space-y-1 text-left">
        <div className="flex items-center gap-2">
          <VictoriaAvatar size={56} />
          <p className="text-muted-foreground">Victoria says:</p>
        </div>
        <div className="relative ml-2 rounded-2xl bg-muted/50 px-6 py-5">
          <div className="absolute -top-2 left-8 size-4 rotate-45 rounded-[3px] bg-muted/50" />
          <blockquote className="space-y-3 text-lg text-foreground">
            <p>
              &ldquo;NextChapter will make your plan clear, reduce the friction, and support you
              every single day.
            </p>
            <p>It cannot do the search for you.</p>
            <p>
              By Week 6, a serious plan will require sustained market-facing effort — probably 8
              to 12 hours of high-quality activity each week.
            </p>
            <p>
              Not everyone is in a position to commit to that right now, and that&apos;s okay. But
              if you can&apos;t, the results will reflect it.
            </p>
            <p>Are you prepared to commit to that?&rdquo;</p>
          </blockquote>
        </div>
      </div>
      <ContractChoice />
    </div>
  )
}
