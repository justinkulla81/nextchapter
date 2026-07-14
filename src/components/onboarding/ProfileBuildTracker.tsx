const PROGRESS_MESSAGES = [
  { threshold: 0, message: "Let's start mapping how you work…" },
  { threshold: 0.3, message: 'Your work-style profile is taking shape…' },
  { threshold: 0.6, message: "More than halfway there — it's really coming together…" },
  { threshold: 0.9, message: 'Almost there — your profile is nearly complete…' },
]

export function ProfileBuildTracker({
  completedItems,
  totalItems,
  isLastStep,
  encouragement,
  thinking,
}: {
  completedItems: number
  totalItems: number
  isLastStep: boolean
  encouragement: string | null
  thinking: boolean
}) {
  const ratio = totalItems > 0 ? completedItems / totalItems : 0
  const message = isLastStep
    ? 'Last stretch — finish this page and your work-style profile is complete.'
    : [...PROGRESS_MESSAGES].reverse().find((m) => ratio >= m.threshold)?.message

  return (
    <div className="rounded-xl border border-light-gray bg-off-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-navy">Building your work-style profile</p>
        <p className="text-sm font-medium text-success tabular-nums">
          {completedItems} of {totalItems} questions answered
        </p>
      </div>

      {/* Progress track with a moving NextChapter arrow */}
      <div className="relative mt-4 h-2 w-full rounded-full bg-light-gray">
        <div
          className="h-full rounded-full bg-success/30 transition-all duration-700 ease-out"
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 transition-all duration-700 ease-out"
          style={{ left: `calc(${Math.round(ratio * 100)}% - 10px)` }}
        >
          <svg viewBox="0 0 24 24" fill="none" className="size-5 drop-shadow-sm">
            <circle cx="12" cy="12" r="11" className="fill-success" />
            <path
              d="M8 12h7M12 8l4 4-4 4"
              stroke="white"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      <div className="mt-3 min-h-5">
        {thinking ? (
          <p className="flex items-center gap-2 text-sm text-brand">
            <span className="flex gap-0.5">
              <span className="size-1.5 animate-bounce rounded-full bg-brand [animation-delay:-0.3s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-brand [animation-delay:-0.15s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-brand" />
            </span>
            Reading your answers…
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {encouragement ?? message}
          </p>
        )}
      </div>
    </div>
  )
}
