'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

// NextChapter's branded loading indicator — a tile that flips from "N" to
// "C", so an async wait reads as "this product is working," not a generic
// browser spinner. No logomark exists to animate (Logo.tsx is wordmark-only),
// so this is deliberately its own simple mark rather than an animated
// version of the wordmark.
//
// Driven by a small JS state machine (not a static @keyframes loop) so each
// N->C->N cycle can end with a random whimsical flourish: a 1- or 2-turn
// spin, clockwise or counterclockwise, picked fresh each cycle. `angle`
// only ever increases — CSS interpolates rotateY's raw degree value rather
// than the shortest visual path, so a continuously growing angle always
// spins forward through whichever turns were chosen without ever "snapping
// back," and a negative delta (counterclockwise) still animates smoothly
// because the transition is on the numeric value, not a wrapped one.
// Respects prefers-reduced-motion by never starting the loop, leaving the
// tile on its static "N" face.
interface Phase {
  deltaDeg: number
  durationMs: number
  easing: string
}

const HOLD_MS = 880
const FLIP_MS = 220
const FLIP_EASING = 'ease-in-out'
const FLOURISH_EASING = 'cubic-bezier(0.33, 1, 0.68, 1)'
// Checked once per completed N->C->N cycle — kept well under 50% so the
// flourish reads as an occasional surprise, not a metronome.
const FLOURISH_CHANCE = 0.35

function pickFlourish(): Phase | null {
  if (Math.random() > FLOURISH_CHANCE) return null
  const spins = Math.random() < 0.65 ? 1 : 2
  const direction = Math.random() < 0.5 ? 1 : -1
  return { deltaDeg: direction * spins * 360, durationMs: spins * 420, easing: FLOURISH_EASING }
}

function buildCycle(): Phase[] {
  const phases: Phase[] = [
    { deltaDeg: 0, durationMs: HOLD_MS, easing: FLIP_EASING }, // hold on N
    { deltaDeg: 180, durationMs: FLIP_MS, easing: FLIP_EASING }, // flip to C
    { deltaDeg: 0, durationMs: HOLD_MS, easing: FLIP_EASING }, // hold on C
    { deltaDeg: 180, durationMs: FLIP_MS, easing: FLIP_EASING }, // flip back to N
  ]
  const flourish = pickFlourish()
  if (flourish) phases.push(flourish)
  return phases
}

export function Spinner({ className, size = 20 }: { className?: string; size?: number }) {
  const fontSize = Math.round(size * 0.5)
  const [angle, setAngle] = useState(0)
  const [transition, setTransition] = useState(`transform ${FLIP_MS}ms ${FLIP_EASING}`)
  const queueRef = useRef<Phase[]>([])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout>

    function runNext() {
      if (cancelled) return
      if (queueRef.current.length === 0) {
        queueRef.current = buildCycle()
      }
      const phase = queueRef.current.shift()!
      setTransition(`transform ${phase.durationMs}ms ${phase.easing}`)
      setAngle((prev) => prev + phase.deltaDeg)
      timeoutId = setTimeout(runNext, phase.durationMs)
    }

    runNext()
    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [])

  return (
    <span
      className={cn('inline-block [perspective:240px]', className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    >
      <span
        className="relative block h-full w-full [transform-style:preserve-3d]"
        style={{ transform: `rotateY(${angle}deg)`, transition }}
      >
        <span
          className="absolute inset-0 flex items-center justify-center rounded-[0.2em] font-medium text-white [backface-visibility:hidden]"
          style={{ background: 'var(--color-navy)', fontSize }}
        >
          N
        </span>
        <span
          className="absolute inset-0 flex items-center justify-center rounded-[0.2em] font-medium [backface-visibility:hidden] [transform:rotateY(180deg)]"
          style={{ background: 'var(--color-orange)', color: 'var(--color-navy)', fontSize }}
        >
          C
        </span>
      </span>
    </span>
  )
}

// Inline "spinner + label" row for a section that's still generating —
// drop-in replacement for the plain text-only "X is generating — check
// back in a moment" copy used across report pages, so the wait has a
// visible working signal instead of just static text.
export function InlineLoadingState({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
      <Spinner size={16} />
      <span>{label}</span>
    </div>
  )
}

// Full-page centered spinner for route-level loading.tsx files.
export function PageLoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <Spinner size={48} />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
