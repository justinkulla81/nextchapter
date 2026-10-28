'use client'

import { useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Spinner } from '@/components/ui/spinner'

const SIZE = 28

// While `active`, the mouse pointer becomes NextChapter's N/C spinner. A CSS cursor can only be a still
// image, so the real Spinner is drawn at the pointer and the native cursor is hidden for as long as it shows.
// Touch has no pointer to replace, and until the mouse has moved on the page we don't know where to draw, so
// both keep the form's own busy cursor.
export function SpinnerCursor({ active }: { active?: boolean }) {
  // Placed inside a <form action>, with no `active`, it follows that form's own saving state.
  const { pending: formPending } = useFormStatus()
  const on = active ?? formPending
  const ref = useRef<HTMLDivElement>(null)
  const pos = useRef<{ x: number; y: number } | null>(null)
  const [hasPointer, setHasPointer] = useState(false)

  function place() {
    const el = ref.current
    if (el && pos.current) el.style.transform = `translate(${pos.current.x - SIZE / 2}px, ${pos.current.y - SIZE / 2}px)`
  }

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (e.pointerType === 'touch') return
      pos.current = { x: e.clientX, y: e.clientY }
      setHasPointer(true)
      place()
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  const showing = on && hasPointer
  useEffect(() => {
    if (showing) place()
  }, [showing])

  if (!showing) return null
  return (
    <>
      <style>{'*{cursor:none!important}'}</style>
      <div ref={ref} aria-hidden className="pointer-events-none fixed top-0 left-0 z-[9999]">
        <Spinner size={SIZE} />
      </div>
    </>
  )
}
