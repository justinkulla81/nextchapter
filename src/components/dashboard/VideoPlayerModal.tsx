'use client'

import { X } from 'lucide-react'
import { Dialog, DialogClose, DialogPopup } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// A single on-demand iframe (mounted only while open, unmounted on close via
// Base UI's default keepMounted=false) rather than a per-card embed — a
// carousel can hold 50+ items, and CuratedVideoCard.tsx already documents
// why loading that many YouTube iframes at once would be a real perf cost.
// Autoplay + full-viewport dark backdrop is the "TV viewer" framing: land in
// a lights-down theater view without ever navigating off the site.
export function VideoPlayerModal({
  open,
  onOpenChange,
  youtubeVideoId,
  title,
  isShort,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  youtubeVideoId: string
  title: string
  isShort: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="w-[min(92vw,calc(100vh*16/9-4rem))] max-w-4xl">
        <DialogClose className="absolute -top-10 right-0 flex size-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20">
          <X className="size-5" />
          <span className="sr-only">Close</span>
        </DialogClose>
        <div
          className={cn(
            'mx-auto overflow-hidden rounded-lg bg-black shadow-2xl',
            isShort ? 'aspect-[9/16] h-[85vh]' : 'aspect-video w-full'
          )}
        >
          {open && (
            <iframe
              key={youtubeVideoId}
              src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&rel=0`}
              title={title}
              className="size-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
      </DialogPopup>
    </Dialog>
  )
}
