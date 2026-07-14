'use client'

import { useState } from 'react'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TRADEOFF_PRIORITIES } from '@/lib/constants/onboarding'
import type { CandidateProfile } from '@prisma/client'

type Key = (typeof TRADEOFF_PRIORITIES)[number]['key']

const LABEL_BY_KEY = Object.fromEntries(
  TRADEOFF_PRIORITIES.map((p) => [p.key, p.label])
) as Record<Key, string>

function initialOrder(profile: CandidateProfile): Key[] {
  const withRanks = TRADEOFF_PRIORITIES.map((p) => ({ key: p.key, rank: profile[p.key] }))
  if (withRanks.every((p) => p.rank !== null)) {
    return withRanks
      .sort((a, b) => (a.rank as number) - (b.rank as number))
      .map((p) => p.key)
  }
  return TRADEOFF_PRIORITIES.map((p) => p.key)
}

export function TradeoffRanking({ profile }: { profile: CandidateProfile }) {
  const [order, setOrder] = useState<Key[]>(() => initialOrder(profile))

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= order.length) return
    setOrder((prev) => {
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  return (
    <div className="space-y-2">
      <ol className="space-y-2">
        {order.map((key, index) => (
          <li
            key={key}
            className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
          >
            <span className="w-5 text-sm font-medium text-muted-foreground">{index + 1}</span>
            <span className="flex-1 text-sm">{LABEL_BY_KEY[key]}</span>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Move ${LABEL_BY_KEY[key]} up`}
              >
                <ArrowUp />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => move(index, 1)}
                disabled={index === order.length - 1}
                aria-label={`Move ${LABEL_BY_KEY[key]} down`}
              >
                <ArrowDown />
              </Button>
            </div>
          </li>
        ))}
      </ol>
      {order.map((key) => (
        <input key={key} type="hidden" name="tradeoffOrder" value={key} />
      ))}
    </div>
  )
}
