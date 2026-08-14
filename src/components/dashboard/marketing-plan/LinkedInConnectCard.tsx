// Standalone, promoted LinkedIn connect callout for My Marketing Plan —
// previously the only way to connect was to first draft a Core Narrative,
// scroll into "Ways to Say It," and notice a small "Connect LinkedIn to
// post" link next to the LinkedIn About/Headline rows. This surfaces the
// same connection (src/lib/linkedin/oauth.ts) up front, gated on nothing
// but isLinkedInPostingConfigured() — matches the GoogleConnectPrompt
// pattern used for Gmail/Calendar. Renders nothing if the LinkedIn OAuth
// app isn't configured (no env vars set) — same convention as the
// LinkedIn button elsewhere on this page.
export function LinkedInConnectCard({ connected }: { connected: boolean }) {
  if (connected) {
    return (
      <div className="flex items-center gap-2 text-sm text-foreground">
        <span className="flex size-5 shrink-0 items-center justify-center rounded bg-[#0A66C2] text-[10px] font-bold text-white">
          in
        </span>
        LinkedIn connected — you can post your narrative directly from Ways to Say It below.
      </div>
    )
  }

  return (
    <div className="space-y-2 rounded-lg border border-[#0A66C2]/30 bg-[#0A66C2]/5 p-4">
      <div className="flex items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded bg-[#0A66C2] text-xs font-bold text-white">
          in
        </span>
        <p className="text-sm font-medium text-foreground">Connect LinkedIn</p>
      </div>
      <p className="text-sm text-muted-foreground">
        Once your Core Narrative is drafted, connect LinkedIn to post your About section or headline
        directly from here — no copy-pasting. Every post counts as real, visible activity on your
        Certified Executive Dossier, not just a resume claim.
      </p>
      <a
        href="/api/auth/linkedin/start"
        className="inline-flex h-9 items-center justify-center rounded-md bg-[#0A66C2] px-4 text-sm font-medium text-white hover:bg-[#0A66C2]/90"
      >
        Connect LinkedIn
      </a>
    </div>
  )
}
