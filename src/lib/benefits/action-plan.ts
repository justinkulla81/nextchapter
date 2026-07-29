// Prompt 72 — deterministic action-plan generation branching on the
// structured multi-select pressures, replacing the old LLM call that
// read free text (src/lib/reports/benefits-plan.ts, removed). Each item
// has a stable semantic id so the same underlying step (e.g. "file for
// unemployment") collapses into one card even when multiple selected
// pressures would otherwise suggest it twice.
export interface BenefitsActionItem {
  id: string
  text: string
}

const ITEM_LIBRARY: Record<string, BenefitsActionItem> = {
  file_ui: {
    id: 'file_ui',
    text: "File for unemployment insurance right away if you haven't — most states let you apply the same week you lose your job, through your state office (not a national site).",
  },
  calc_runway: {
    id: 'calc_runway',
    text: 'Calculate your real runway: essential expenses ÷ (savings + expected unemployment benefits). See Budgeting below.',
  },
  compare_health: {
    id: 'compare_health',
    text: 'Compare COBRA vs. a Healthcare.gov marketplace plan — losing job coverage qualifies you for a Special Enrollment Period, so you do not have to wait for open enrollment.',
  },
  check_wioa_support: {
    id: 'check_wioa_support',
    text: "Ask your local American Job Center what dislocated-worker support (training, childcare, transportation) you qualify for — eligibility is broader than most people assume.",
  },
  talk_credit_counselor: {
    id: 'talk_credit_counselor',
    text: 'Talk to a free nonprofit credit counselor (NFCC) before making any big financial decision — they can walk through the real tradeoffs with you, no cost, no sales pitch.',
  },
  review_401k: {
    id: 'review_401k',
    text: 'If you might need to tap retirement savings, understand the real cost of a 401(k) withdrawal vs. a hardship withdrawal or loan before deciding — see Tapping retirement savings below.',
  },
  confirm_immigration_eligibility: {
    id: 'confirm_immigration_eligibility',
    text: 'Unemployment insurance and other benefits have work-authorization requirements that vary by status and state — confirm your specific eligibility directly with your state unemployment office. This page cannot give personalized immigration or legal guidance.',
  },
  other_conversation: {
    id: 'other_conversation',
    text: 'Start with the general resources on this page, and consider a free nonprofit credit counselor (NFCC) session — most less-common financial pressures benefit from a real conversation more than generic advice.',
  },
}

const PRESSURE_TO_ITEM_IDS: Record<string, string[]> = {
  RENT_MORTGAGE: ['file_ui', 'calc_runway'],
  HEALTH_INSURANCE: ['compare_health'],
  DEPENDENTS_CHILDCARE: ['check_wioa_support'],
  DEBT_PAYMENTS: ['talk_credit_counselor'],
  NO_EMERGENCY_SAVINGS: ['file_ui', 'review_401k'],
  SUPPORTING_FAMILY: ['calc_runway', 'talk_credit_counselor'],
  IMMIGRATION_STATUS: ['confirm_immigration_eligibility'],
  OTHER: ['other_conversation'],
}

export function getBenefitsActionPlanItems(pressures: string[]): BenefitsActionItem[] {
  const seen = new Set<string>()
  const items: BenefitsActionItem[] = []

  for (const pressure of pressures) {
    for (const itemId of PRESSURE_TO_ITEM_IDS[pressure] ?? []) {
      if (seen.has(itemId)) continue
      seen.add(itemId)
      items.push(ITEM_LIBRARY[itemId])
    }
  }

  return items
}
