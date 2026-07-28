'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toggleInBook } from '@/app/recruiters/(app)/candidates/actions'

export function ToggleBookButton({
  sourcedCandidateId,
  inBook,
}: {
  sourcedCandidateId: string
  inBook: boolean
}) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(() => {
      toggleInBook(sourcedCandidateId, inBook)
    })
  }

  return (
    <Button
      type="button"
      variant={inBook ? 'outline' : 'default'}
      onClick={handleClick}
      disabled={isPending}
      className={isPending ? 'cursor-progress' : undefined}
    >
      {isPending ? 'Updating…' : inBook ? 'Remove from book' : 'Add to book'}
    </Button>
  )
}
