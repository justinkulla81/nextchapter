'use client'

import { PreviewShell } from '@/components/candidate/PreviewShell'
import { WidenStrategyFlow } from '@/components/dashboard/widen/WidenStrategyFlow'
import type { WidenStrategyView } from '@/lib/jobs/widen-strategy'

// Widen your search, fed sample data (the real component, preview mode: no server calls). Dev-only.
const VIEW: WidenStrategyView = {
  fnLabel: 'Finance',
  homeState: 'OH',
  citiesForFunction: [
    { city: 'New York Metro', state: 'NY', stateName: 'New York', openNow: 1840, home: false },
    { city: 'Chicago Metro', state: 'IL', stateName: 'Illinois', openNow: 712, home: false },
    { city: 'Dallas-Fort Worth Metro', state: 'TX', stateName: 'Texas', openNow: 655, home: false },
    { city: 'Charlotte Metro', state: 'NC', stateName: 'North Carolina', openNow: 498, home: false },
    { city: 'Columbus Metro', state: 'OH', stateName: 'Ohio', openNow: 231, home: true },
    { city: 'Atlanta Metro', state: 'GA', stateName: 'Georgia', openNow: 402, home: false },
  ],
  citiesForIndustry: {
    industry: 'Healthcare & Hospital Systems',
    cities: [
      { city: 'Nashville Metro', state: 'TN', stateName: 'Tennessee', openNow: 96, home: false },
      { city: 'Boston Metro', state: 'MA', stateName: 'Massachusetts', openNow: 81, home: false },
      { city: 'Cleveland Metro', state: 'OH', stateName: 'Ohio', openNow: 44, home: true },
      { city: 'Minneapolis-St. Paul Metro', state: 'MN', stateName: 'Minnesota', openNow: 40, home: false },
    ],
  },
  remoteOpen: 386,
  industries: [
    { industry: 'Financial Services & Banking', openNow: 214 },
    { industry: 'Technology & Software', openNow: 167 },
    { industry: 'Manufacturing & Industrial', openNow: 98 },
    { industry: 'Insurance', openNow: 61 },
  ],
  roles: [
    { role: 'fpa_analyst', label: 'FP&A manager', openNow: 520, carry: ['forecasting', 'budgeting', 'Excel'], toAdd: ['Power BI', 'SQL'] },
    { role: 'revenue_ops', label: 'Revenue operations manager', openNow: 310, carry: ['forecasting', 'reporting'], toAdd: ['Salesforce', 'HubSpot'] },
    { role: 'procurement', label: 'Procurement manager', openNow: 190, carry: ['vendor management', 'budgeting'], toAdd: ['SAP', 'contract negotiation'] },
  ],
  skills: {
    label: 'finance',
    basis: 18240,
    have: [
      { slug: 'excel', name: 'Excel', share: 41 },
      { slug: 'forecasting', name: 'Forecasting', share: 22 },
      { slug: 'budgeting', name: 'Budgeting', share: 19 },
    ],
    missing: [
      { slug: 'sql', name: 'SQL', share: 14 },
      { slug: 'power-bi', name: 'Power BI', share: 11 },
      { slug: 'netsuite', name: 'NetSuite', share: 8 },
    ],
  },
  industrySkills: {
    label: 'Financial Services & Banking',
    basis: 9400,
    have: [{ slug: 'excel', name: 'Excel', share: 30 }],
    missing: [
      { slug: 'risk-management', name: 'Risk management', share: 18 },
      { slug: 'sox', name: 'SOX', share: 9 },
    ],
  },
  on: { remote: false, states: [], industries: [], roles: [] },
  savedAt: null,
}

const Page = () => (
  <PreviewShell place="jobs" entry="find">
    <WidenStrategyFlow view={VIEW} from="board" preview />
  </PreviewShell>
)

export const WidenStrategyPreview = () => <Page />
