'use client'

import { useActionState } from 'react'
import Image from 'next/image'
import { generateHeadshotAction, generateBannerAction } from '@/app/dashboard/linkedin/actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const EXAMPLES = [
  { before: '/marketing/headshot-man-before.png', after: '/marketing/headshot-man-after.png' },
  { before: '/marketing/headshot-woman-before.png', after: '/marketing/headshot-woman-after.png' },
]

function ExamplePair({ before, after }: { before: string; after: string }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <div className="overflow-hidden rounded-lg border border-border">
          <Image src={before} alt="Before — casual photo" width={300} height={300} className="w-full" />
        </div>
        <p className="text-center text-xs text-muted-foreground">Before</p>
      </div>
      <div className="space-y-1">
        <div className="overflow-hidden rounded-lg border border-brand">
          <Image src={after} alt="After — professional headshot" width={300} height={300} className="w-full" />
        </div>
        <p className="text-center text-xs font-medium text-brand">After</p>
      </div>
    </div>
  )
}

export function HeadshotCreator() {
  const [headshotState, headshotAction, headshotPending] = useActionState(generateHeadshotAction, undefined)
  const [bannerState, bannerAction, bannerPending] = useActionState(generateBannerAction, undefined)

  return (
    <div className="space-y-6 rounded-lg border border-border p-4">
      <div>
        <h2 className="text-sm font-medium text-foreground">Headshot & banner creator</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Recruiters judge a profile in seconds — a real photographer&apos;s headshot is expensive
          and slow to schedule. This turns a phone photo into one, free, in under a minute.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {EXAMPLES.map((ex) => (
          <ExamplePair key={ex.before} {...ex} />
        ))}
      </div>

      <div className="space-y-4 border-t border-border pt-4">
        <form
          action={headshotAction}
          className={cn('space-y-3', headshotPending && 'cursor-progress [&_*]:cursor-progress')}
        >
          <Label htmlFor="photo">Upload your photo (JPG or PNG, up to 10MB)</Label>
          <Input id="photo" name="photo" type="file" accept="image/*" required disabled={headshotPending} />
          {headshotState?.error && <p className="text-sm text-destructive">{headshotState.error}</p>}
          <Button type="submit" disabled={headshotPending}>
            {headshotPending ? 'Generating your headshot…' : 'Generate my headshot'}
          </Button>
        </form>

        {headshotState?.image && (
          <div className="space-y-2 rounded-lg border border-brand/30 bg-off-white p-3">
            <p className="text-sm font-medium text-foreground">Your new headshot</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL, not an optimizable static asset */}
            <img
              src={headshotState.image.dataUrl}
              alt="Your generated professional headshot"
              className="max-w-xs rounded-lg border border-border"
            />
            <a
              href={headshotState.image.dataUrl}
              download="linkedin-headshot.png"
              className="inline-block text-sm font-medium text-brand underline underline-offset-4"
            >
              Download headshot
            </a>
          </div>
        )}
      </div>

      <div className="space-y-4 border-t border-border pt-4">
        <div>
          <p className="text-sm font-medium text-foreground">Matching LinkedIn banner</p>
          <p className="text-sm text-muted-foreground">
            A clean, professional background image for the top of your profile — no upload needed.
          </p>
        </div>
        <form action={bannerAction} className={cn(bannerPending && 'cursor-progress [&_*]:cursor-progress')}>
          <Button type="submit" disabled={bannerPending}>
            {bannerPending ? 'Generating your banner…' : 'Generate my banner'}
          </Button>
        </form>
        {bannerState?.error && <p className="text-sm text-destructive">{bannerState.error}</p>}

        {bannerState?.image && (
          <div className="space-y-2 rounded-lg border border-brand/30 bg-off-white p-3">
            <p className="text-sm font-medium text-foreground">Your new banner</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL, not an optimizable static asset */}
            <img
              src={bannerState.image.dataUrl}
              alt="Your generated LinkedIn banner"
              className="w-full rounded-lg border border-border"
            />
            <a
              href={bannerState.image.dataUrl}
              download="linkedin-banner.png"
              className="inline-block text-sm font-medium text-brand underline underline-offset-4"
            >
              Download banner
            </a>
          </div>
        )}
      </div>

      <div className="space-y-2 rounded-lg border border-light-gray bg-off-white p-4">
        <p className="text-sm font-medium text-foreground">How to upload these to LinkedIn</p>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Headshot:</span> LinkedIn → your profile →
            click your current profile photo → &quot;Change photo&quot; → upload the downloaded file →
            adjust crop → Apply.
          </li>
          <li>
            <span className="font-medium text-foreground">Banner:</span> LinkedIn → your profile →
            click the pencil icon on the background photo → upload the downloaded file → reposition →
            Apply.
          </li>
        </ul>
      </div>
    </div>
  )
}
