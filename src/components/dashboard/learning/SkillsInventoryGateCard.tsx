import Link from 'next/link'

// First card on the Learning page when the Skills Inventory hasn't been
// taken yet — it directly drives what shows up below (job function, AI
// fluency, etc. feed job/course matching, per skills-assessments/page.tsx),
// so an incomplete candidate should see this before anything else.
export function SkillsInventoryGateCard() {
  return (
    <div className="space-y-2 rounded-lg border border-brand/30 bg-brand/5 p-4">
      <p className="text-sm font-medium text-foreground">Take the Skills Inventory first</p>
      <p className="text-sm text-muted-foreground">
        Your core function, AI fluency, and a few other skills drive how jobs and courses below get matched to
        you — the recommendations on this page will be a lot more useful once we know that.
      </p>
      <Link
        href="/dashboard/skills-assessment"
        className="inline-block text-sm font-medium text-primary underline underline-offset-4"
      >
        Take the Skills Inventory
      </Link>
    </div>
  )
}
