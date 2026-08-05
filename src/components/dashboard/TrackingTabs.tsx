'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function TrackingTabs({
  emailContent,
  calendarContent,
  emailAlertCount,
  calendarAlertCount,
  defaultTab,
}: {
  emailContent: ReactNode
  calendarContent: ReactNode
  emailAlertCount: number
  calendarAlertCount: number
  defaultTab: 'email' | 'calendar'
}) {
  const [tab, setTab] = useState<'email' | 'calendar'>(defaultTab)

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <TabButton label="Email" alertCount={emailAlertCount} active={tab === 'email'} onClick={() => setTab('email')} />
        <TabButton
          label="Calendar"
          alertCount={calendarAlertCount}
          active={tab === 'calendar'}
          onClick={() => setTab('calendar')}
        />
      </div>
      {tab === 'email' ? emailContent : calendarContent}
    </div>
  )
}

function TabButton({
  label,
  alertCount,
  active,
  onClick,
}: {
  label: string
  alertCount: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'border-brand bg-brand/5 text-brand'
          : 'border-border text-muted-foreground hover:text-foreground'
      )}
    >
      {label}
      {alertCount > 0 && (
        <span className="rounded-full bg-orange/20 px-1.5 py-0.5 text-[10px] font-semibold text-orange">
          {alertCount}
        </span>
      )}
    </button>
  )
}
