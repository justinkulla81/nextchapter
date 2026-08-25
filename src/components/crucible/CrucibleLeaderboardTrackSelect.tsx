'use client'

import { useRouter } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CRUCIBLE_JOB_INTENT_LABEL, type CrucibleJobIntentKey } from '@/lib/crucible/variants'

const TRACKS = Object.keys(CRUCIBLE_JOB_INTENT_LABEL) as CrucibleJobIntentKey[]

// 6 tracks — design-principles.md calls for a dropdown once there are 5+
// options, not adjacent buttons.
export function CrucibleLeaderboardTrackSelect({ value }: { value: CrucibleJobIntentKey }) {
  const router = useRouter()

  return (
    <Select value={value} onValueChange={(next) => next && router.push(`/noexperience/leaderboard?track=${next}`)}>
      <SelectTrigger className="mx-auto w-full max-w-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TRACKS.map((track) => (
          <SelectItem key={track} value={track}>
            {CRUCIBLE_JOB_INTENT_LABEL[track]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
