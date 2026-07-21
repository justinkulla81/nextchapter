import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const VICTORIA_PHOTO_PATH = '/marketing/victoria-headshot-v4.jpg'

// Shown instead of the real chat to visitors who don't have a registered
// candidate account yet — the actual chat needs a real conversation/profile
// behind it, so this is a static mockup of what talking to Victoria looks
// like, plus the one real action a brand-new visitor can take.
export function VictoriaChatPreview() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand/10 text-brand">
            <Image src={VICTORIA_PHOTO_PATH} alt="Victoria" width={40} height={40} className="size-10 object-cover" />
          </span>
          <CardTitle className="text-sm font-medium text-foreground">
            Hi, I&apos;m Victoria, Your Executive Coach
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg bg-muted px-3 py-2 text-sm">
              How are you feeling about the search today?
            </div>
          </div>
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
              I got rejected today — not great.
            </div>
          </div>
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg bg-muted px-3 py-2 text-sm">
              That&apos;s a real gut-punch, and it happens in every search — it doesn&apos;t mean
              your search is broken. Let&apos;s find one thing you can do today that&apos;s
              actually in your control.
            </div>
          </div>
        </div>
        <Button nativeButton={false} className="w-full" render={<Link href="/onboarding/resume" />}>
          Start your free assessment to chat with Victoria
        </Button>
      </CardContent>
    </Card>
  )
}
