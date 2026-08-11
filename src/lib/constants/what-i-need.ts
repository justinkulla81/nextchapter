// What I Need (spec §4.4) — 24 items across 6 O*NET Work Value domains,
// rated Not important/Somewhat/Important/Essential, plus a drag-rank of
// the 6 domains. Item text is verbatim from the spec.

export type WorkValueDomain =
  | 'ACHIEVEMENT'
  | 'INDEPENDENCE'
  | 'RECOGNITION'
  | 'RELATIONSHIPS'
  | 'SUPPORT'
  | 'WORKING_CONDITIONS'

export const WORK_VALUE_DOMAIN_ORDER: WorkValueDomain[] = [
  'ACHIEVEMENT',
  'INDEPENDENCE',
  'RECOGNITION',
  'RELATIONSHIPS',
  'SUPPORT',
  'WORKING_CONDITIONS',
]

export const WORK_VALUE_DOMAIN_LABELS: Record<WorkValueDomain, string> = {
  ACHIEVEMENT: 'Achievement',
  INDEPENDENCE: 'Independence',
  RECOGNITION: 'Recognition',
  RELATIONSHIPS: 'Relationships',
  SUPPORT: 'Support',
  WORKING_CONDITIONS: 'Working Conditions',
}

export interface WhatINeedItem {
  id: string
  domain: WorkValueDomain
  text: string
}

export const WHAT_I_NEED_ITEMS: WhatINeedItem[] = [
  { id: 'achievement-1', domain: 'ACHIEVEMENT', text: 'Work that uses my abilities fully' },
  { id: 'achievement-2', domain: 'ACHIEVEMENT', text: 'A clear sense of accomplishment from what I produce' },
  { id: 'achievement-3', domain: 'ACHIEVEMENT', text: 'Being able to see the results of my work' },
  { id: 'achievement-4', domain: 'ACHIEVEMENT', text: 'Being good at something genuinely hard' },

  { id: 'independence-1', domain: 'INDEPENDENCE', text: 'Deciding how to do my work without being told' },
  { id: 'independence-2', domain: 'INDEPENDENCE', text: 'Room to try my own ideas' },
  { id: 'independence-3', domain: 'INDEPENDENCE', text: 'Working with little day-to-day supervision' },
  { id: 'independence-4', domain: 'INDEPENDENCE', text: 'Setting my own priorities' },

  { id: 'recognition-1', domain: 'RECOGNITION', text: 'A clear path to advancement' },
  { id: 'recognition-2', domain: 'RECOGNITION', text: 'Being seen as someone with standing in my field' },
  { id: 'recognition-3', domain: 'RECOGNITION', text: 'A title that reflects my actual level' },
  { id: 'recognition-4', domain: 'RECOGNITION', text: "Being told directly when I've done well" },

  { id: 'relationships-1', domain: 'RELATIONSHIPS', text: "Colleagues I'd choose to spend time with" },
  { id: 'relationships-2', domain: 'RELATIONSHIPS', text: 'Work that helps other people' },
  { id: 'relationships-3', domain: 'RELATIONSHIPS', text: 'A manager I trust personally' },
  { id: 'relationships-4', domain: 'RELATIONSHIPS', text: 'A team that genuinely collaborates' },

  { id: 'support-1', domain: 'SUPPORT', text: 'A manager who backs me publicly' },
  { id: 'support-2', domain: 'SUPPORT', text: 'Clear expectations from leadership' },
  { id: 'support-3', domain: 'SUPPORT', text: 'The training and resources to do the job properly' },
  { id: 'support-4', domain: 'SUPPORT', text: 'An organization that stands behind its people' },

  { id: 'working-conditions-1', domain: 'WORKING_CONDITIONS', text: 'Stability and predictability' },
  { id: 'working-conditions-2', domain: 'WORKING_CONDITIONS', text: 'Compensation' },
  { id: 'working-conditions-3', domain: 'WORKING_CONDITIONS', text: 'A schedule that fits the rest of my life' },
  { id: 'working-conditions-4', domain: 'WORKING_CONDITIONS', text: 'A workload I can sustain' },
]

export type ImportanceRating = 1 | 2 | 3 | 4 // Not important / Somewhat / Important / Essential

export const IMPORTANCE_RATING_LABELS: Record<ImportanceRating, string> = {
  1: 'Not important',
  2: 'Somewhat',
  3: 'Important',
  4: 'Essential',
}

export interface WhatINeedItemRating {
  itemId: string
  rating: ImportanceRating
}
