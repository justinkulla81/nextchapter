'use client'

import { useState, type ReactNode } from 'react'

/** The preview's tab bar. The panels are built on the server and handed in, so only the tab choice lives here. */
export function HubTabs({ tabs }: { tabs: { id: string; label: string; panel: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.id)
  return (
    <div>
      <div role="tablist" aria-label="Preview sections" className="flex gap-1 overflow-x-auto border-b border-border px-3 pt-3">
        {tabs.map((t) => (
          <button
            key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={active === t.id} aria-controls={`panel-${t.id}`} type="button" onClick={() => setActive(t.id)}
            className={`whitespace-nowrap rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${active === t.id ? 'bg-white text-navy shadow-[0_1px_0_0_white]' : 'text-muted-foreground hover:text-navy'}`}
          >{t.label}</button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={active !== t.id} className="bg-white p-5 sm:p-6">{t.panel}</div>
      ))}
    </div>
  )
}
