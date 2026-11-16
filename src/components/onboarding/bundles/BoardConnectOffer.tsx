'use client'

import { useState } from 'react'
import { usePostHog } from '@/lib/posthog/client'

// The Where step's offer when the visitor started from a place or workforce-board page that names one board: connect with it.
// Ticked by default, because they came from that board's area and the connection is anonymous: the board sees a count, never a
// name. Sharing their name is a separate choice, off until they turn it on in privacy settings.
export function BoardConnectOffer({ boardId, boardName }: { boardId: string; boardName: string }) {
  const posthog = usePostHog()
  const [on, setOn] = useState(true)
  return (
    <div className="space-y-1">
      <label className="flex items-start gap-3 text-base text-ink">
        <input
          type="checkbox"
          name="connectBoard"
          value={boardId}
          checked={on}
          onChange={(e) => {
            setOn(e.target.checked)
            posthog?.capture('onboarding_board_offer_toggled', { boardId, connect: e.target.checked })
          }}
          className="mt-1 size-5 shrink-0 accent-ink"
        />
        <span>
          Connect me with {boardName}, the workforce board for this area
          <span className="mt-1 block text-sm text-muted-foreground">
            It runs the local job centers and training programs. It sees you only as part of an anonymous count, never your name, unless you choose to share it later in your privacy settings.
          </span>
        </span>
      </label>
    </div>
  )
}
