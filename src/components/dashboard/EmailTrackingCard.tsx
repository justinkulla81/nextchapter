export function EmailTrackingCard() {
  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      <h2 className="text-sm font-medium text-foreground">Know when your email gets opened</h2>
      <p className="text-sm text-muted-foreground">
        Silence after an outreach email is the hardest part — you don&apos;t know if it&apos;s sitting
        unread, got skimmed and forgotten, or landed in spam. A read receipt tells you which one it
        is, so you know exactly when (and whether) to follow up instead of guessing.
      </p>
      <ul className="space-y-1.5 pt-1 text-sm text-muted-foreground">
        <li>
          <span className="font-medium text-foreground">Opened, no reply after 3-4 days</span> —
          send a short, low-pressure follow-up. They saw it; a nudge is fair game.
        </li>
        <li>
          <span className="font-medium text-foreground">Never opened after a week</span> — try a
          different channel (LinkedIn message) or resend with a sharper subject line.
        </li>
      </ul>
      <p className="pt-1 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">How to set it up (free, 2 minutes):</span>{' '}
        install a read-receipt extension for your email — <span className="font-medium">Mailtrack</span>{' '}
        or <span className="font-medium">Streak</span> both work with Gmail. Once installed, every
        email you send gets a small tracking pixel automatically; you&apos;ll see checkmarks next to
        sent messages and get a notification the moment one is opened. No changes to how you write or
        send your emails.
      </p>
    </div>
  )
}
