'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { AUDIENCE_TABS } from './audience-data'
import { WaitlistForm } from './WaitlistForm'

export function AudienceTabsSection() {
  return (
    <section id="for-teams" className="border-b border-border bg-off-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-sm font-semibold tracking-wide text-brand uppercase">
          Who we&apos;re building for
        </h2>

        <Tabs defaultValue={AUDIENCE_TABS[0].id} className="mt-8">
          <div className="overflow-x-auto">
            <TabsList className="h-auto min-w-full justify-start gap-1 bg-light-gray p-1">
              {AUDIENCE_TABS.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="shrink-0 px-3 py-2">
                  {tab.eyebrow}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {AUDIENCE_TABS.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="mt-8">
              <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
                <div>
                  <h3 className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">
                    {tab.headline}
                  </h3>
                  <p className="mt-4 text-lg text-muted-foreground">{tab.subhead}</p>

                  <ul className="mt-8 space-y-4">
                    {tab.points.map((point) => (
                      <li key={point.lead} className="flex items-start gap-3">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-success" />
                        <span className="text-base leading-relaxed text-foreground">
                          <span className="font-semibold">{point.lead}</span> {point.body}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8 rounded-lg border border-light-gray bg-white p-4">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      <span className="font-medium text-foreground">{tab.contrastLabel}</span>{' '}
                      {tab.contrastBody}
                    </p>
                  </div>
                </div>

                <Card className="h-fit">
                  <CardContent className="pt-6">
                    <WaitlistForm tab={tab} />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  )
}
