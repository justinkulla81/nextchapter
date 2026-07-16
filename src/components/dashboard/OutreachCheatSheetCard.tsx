export function OutreachCheatSheetCard() {
  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      <h2 className="text-sm font-medium text-foreground">Email vs. LinkedIn — quick cheat sheet</h2>
      <ul className="space-y-1.5 text-sm text-muted-foreground">
        <li>
          <span className="font-medium text-foreground">Email</span> — best for people you already
          have an address for. Feels more personal and less &ldquo;networking-app,&rdquo; and it&apos;s
          easy for them to reply from their phone later.
        </li>
        <li>
          <span className="font-medium text-foreground">LinkedIn message</span> — best for people
          you&apos;re only connected to on LinkedIn. Keep it shorter than an email — people skim there.
        </li>
        <li>
          <span className="font-medium text-foreground">Best times to send</span> — Tuesday through
          Thursday, mid-morning or early afternoon. Avoid Monday (inbox pileup) and Friday afternoon
          (already checked out).
        </li>
      </ul>
    </div>
  )
}
