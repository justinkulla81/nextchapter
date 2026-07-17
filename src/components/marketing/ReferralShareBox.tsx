'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

const SITE_URL = 'https://launchyournextchapter.com'
const MESSAGE = "I've been using NextChapter for my job search — it's free, and it gives you an honest read on where you stand plus a real weekly plan. Thought of you. Worth a look:"

export function ReferralShareBox() {
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    await navigator.clipboard.writeText(SITE_URL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const mailtoHref = `mailto:?subject=${encodeURIComponent('Thought you might find this helpful')}&body=${encodeURIComponent(`${MESSAGE}\n\n${SITE_URL}`)}`

  return (
    <div className="space-y-3 rounded-xl border border-light-gray bg-off-white p-6">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2.5 text-left">
        <span className="flex-1 truncate text-sm text-muted-foreground">{SITE_URL}</span>
        <Button size="sm" variant="outline" onClick={copyLink} className="cursor-pointer">
          {copied ? 'Copied!' : 'Copy link'}
        </Button>
      </div>
      <Button
        size="lg"
        variant="cta"
        className="w-full"
        render={<a href={mailtoHref} />}
      >
        Send them an email
      </Button>
    </div>
  )
}
