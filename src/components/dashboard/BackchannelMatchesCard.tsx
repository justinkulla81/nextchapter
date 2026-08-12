import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ContactQuickLink } from '@/components/dashboard/ContactQuickLink'
import type { BackchannelMatch } from '@/lib/network/backchannel'

export function BackchannelMatchesCard({ matches }: { matches: BackchannelMatch[] }) {
  if (matches.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>You might know someone at these companies</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Backchanneling — having someone on the inside flag your application to the hiring
          manager — meaningfully raises your odds of getting a real look, versus the application
          sitting in a queue with hundreds of others. Here&apos;s who&apos;s already in your
          network at companies you&apos;ve applied to.
        </p>
        {matches.map((m) => (
          <div key={m.job.id} className="rounded-lg border border-border p-3">
            <p className="text-sm font-medium text-foreground">
              {m.job.companyName}
              {m.job.title ? ` — ${m.job.title}` : ''}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-muted-foreground">
              <span>Who can help:</span>
              {m.contacts.map((c, i) => (
                <span key={c.id} className="flex items-center">
                  <ContactQuickLink name={c.name} email={c.email} linkedinUrl={c.linkedinUrl} className="text-xs" />
                  {i < m.contacts.length - 1 && <span className="text-muted-foreground">,</span>}
                </span>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
