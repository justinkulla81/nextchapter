import { HiringManagerSignupForm } from '@/components/hiring/HiringManagerSignupForm'

export default function HiringManagerSignupPage() {
  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <div className="mb-6 space-y-2">
        <p className="text-sm font-medium text-muted-foreground">NextChapter for Hiring</p>
        <h1 className="text-2xl font-semibold tracking-tight">Interview better, not longer</h1>
        <p className="text-muted-foreground">
          Every candidate submitted to your req arrives with evidence already gathered — a
          generated interview guide, panel coordination, and structured scorecards.
        </p>
      </div>
      <HiringManagerSignupForm />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Already set up?{' '}
        <a href="/hiring/login" className="underline underline-offset-4">
          Log in
        </a>
      </p>
    </div>
  )
}
