// Pure, synchronous, keyword-based employer classification — mirrors
// FUNCTION_KEYWORDS's style (resume-analysis/function-family.ts). Feeds
// resolve-contextual-level.ts's industry-specific title ladders (finance,
// law, investment firms) — no Prisma, no LLM call, since the freeform
// industry text this reads (WorkHistoryEntry.companyIndustry /
// ResumeAnalysisFacts.roles[].industry) is already LLM-populated at resume-
// extraction time (see extract-profile-fields.ts's "companyIndustry: a few
// words" prompt and extract-facts.ts's "industry: a short common noun"
// prompt) — no new call needed to read it again here.
//
// Known limitation, accepted deliberately: pure keyword matching on
// companyName misses funds whose name carries no finance word at all
// ("Citadel", "Sequoia", "Andreessen Horowitz"). The freeform industry text
// is the real signal in practice for those cases; this stays a first-pass
// heuristic, same class of tradeoff as several other keyword classifiers
// already in this codebase (FUNCTION_KEYWORDS, FAMILY_KEYWORDS).

const HEDGE_FUND_PATTERN = /\bhedge fund\b/i
const PE_VC_PATTERN =
  /\b(private equity|venture capital|growth equity|buyout|capital partners|capital management|investment partners|family office)\b/i
const FINANCE_BROAD_PATTERN =
  /\b(bank|banking|financial services|asset management|wealth management|investment bank|capital markets)\b/i
const LAW_FIRM_PATTERN = /\b(llp|law firm|attorneys at law|legal services)\b/i

export interface FirmContext {
  isFinance: boolean // broad: banks, PE, VC, hedge funds, asset/wealth management
  isInvestmentFirm: boolean // PE/VC/hedge fund/family office — not retail/commercial banking
  isHedgeFund: boolean
  isLawFirm: boolean
}

export function detectFirmContext(input: { companyName: string; freeformIndustry?: string | null }): FirmContext {
  const text = `${input.companyName} ${input.freeformIndustry ?? ''}`.toLowerCase()
  const isHedgeFund = HEDGE_FUND_PATTERN.test(text)
  const isInvestmentFirm = isHedgeFund || PE_VC_PATTERN.test(text)
  const isFinance = isInvestmentFirm || FINANCE_BROAD_PATTERN.test(text)
  const isLawFirm = LAW_FIRM_PATTERN.test(text)
  return { isFinance, isInvestmentFirm, isHedgeFund, isLawFirm }
}
