'use client'

import { useMemo, useState } from 'react'
import posthog from 'posthog-js'
import { CopyButton } from '@/components/ui/copy-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { CHANNELS, DEFAULT_LANDING, LANDING_PAGES, SEGMENTS, buildTaggedLink, type ChannelKey } from '@/lib/marketing/campaign-tag'

// The campaigns in the playbook, ready to copy. Partner, community and newsletter links need a name, so they are built above.
const PLANNED: { segment: string; channel: ChannelKey }[] = [
  { segment: 'laid-off-recent', channel: 'google' },
  { segment: 'laid-off-long', channel: 'google' },
  { segment: 'career-change', channel: 'google' },
  { segment: 'ai-retraining', channel: 'google' },
  { segment: 'laid-off-recent', channel: 'facebook' },
  { segment: 'ai-retraining', channel: 'facebook' },
  { segment: 'laid-off-recent', channel: 'linkedin-post' },
  { segment: 'senior', channel: 'linkedin-post' },
  { segment: 'b2b-boards', channel: 'linkedin-ads' },
  { segment: 'b2b-highered', channel: 'linkedin-ads' },
  { segment: 'b2b-employers', channel: 'linkedin-ads' },
  { segment: 'b2b-outplacement', channel: 'google' },
]

const segmentLabel = (key: string) => SEGMENTS.find((s) => s.key === key)?.label ?? key
const channelLabel = (key: string) => CHANNELS.find((c) => c.key === key)?.label ?? key

export function TaggedLinkBuilder() {
  const [segment, setSegment] = useState<string>('laid-off-recent')
  const [channel, setChannel] = useState<ChannelKey>('google')
  const [landing, setLanding] = useState<string>(DEFAULT_LANDING['laid-off-recent'])
  const [name, setName] = useState('')

  const named = CHANNELS.find((c) => c.key === channel)?.named ?? false
  const link = useMemo(() => buildTaggedLink({ segment, channel, landing, name }), [segment, channel, landing, name])
  const track = (s: string, c: string, l: string) => posthog.capture('tagged_link_copied', { segment: s, channel: c, landing: l })

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Build a link</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tl-segment">Audience</Label>
            <NativeSelect
              id="tl-segment"
              name="segment"
              placeholder="Choose an audience"
              defaultValue={segment}
              options={SEGMENTS.map((s) => ({ value: s.key, label: s.label }))}
              onChange={(v) => {
                if (!v) return
                setSegment(v)
                setLanding(DEFAULT_LANDING[v] ?? '/how-it-works')
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tl-channel">Where the link goes</Label>
            <NativeSelect
              id="tl-channel"
              name="channel"
              placeholder="Choose a channel"
              defaultValue={channel}
              options={CHANNELS.map((c) => ({ value: c.key, label: c.label }))}
              onChange={(v) => v && setChannel(v as ChannelKey)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tl-landing">Landing page</Label>
            <NativeSelect
              id="tl-landing"
              name="landing"
              placeholder="Choose a page"
              defaultValue={landing}
              options={LANDING_PAGES.map((p) => ({ value: p.path, label: `${p.label} (${p.path})` }))}
              onChange={(v) => v && setLanding(v)}
            />
          </div>
          {named && (
            <div className="space-y-1.5">
              <Label htmlFor="tl-name">Name of the {channel === 'partner' ? 'partner' : channel === 'community' ? 'community' : 'newsletter'}</Label>
              <Input id="tl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="For example: nawdp" />
            </div>
          )}
        </div>

        {link ? (
          <div className="space-y-2">
            <p className="rounded-md border bg-muted/40 p-3 font-mono text-xs break-all">{link}</p>
            <CopyButton text={link} label="Copy this tagged link" onCopy={() => track(segment, channel, landing)} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Add the name above to build this link. The name is how the funnel page tells one {channel} from another.</p>
        )}
        <p className="text-xs text-muted-foreground">
          The campaign tag is audience, then channel, then the name if there is one. Google links end in utm_term={'{keyword}'}, which Google fills in with the search words.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Campaigns in the playbook</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pb-1 font-normal">Campaign</th>
              <th className="pb-1 text-right font-normal">Link</th>
            </tr>
          </thead>
          <tbody>
            {PLANNED.map((p) => {
              const l = DEFAULT_LANDING[p.segment]
              const url = buildTaggedLink({ segment: p.segment, channel: p.channel, landing: l })
              if (!url) return null
              return (
                <tr key={`${p.segment}-${p.channel}`} className="border-t align-top">
                  <td className="py-1.5">
                    <div className="font-medium">{`${p.segment}-${p.channel}`}</div>
                    <div className="text-xs text-muted-foreground">
                      {segmentLabel(p.segment)} · {channelLabel(p.channel)} · {l}
                    </div>
                  </td>
                  <td className="py-1.5 text-right">
                    <CopyButton text={url} label={`Copy the ${p.segment} ${p.channel} link`} onCopy={() => track(p.segment, p.channel, l)} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}
