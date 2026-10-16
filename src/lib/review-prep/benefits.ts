// The member's own answers about what they want from a job besides salary
// (Search Strategy > Benefits & Compensation Priorities), as a short list to
// ask for in a raise, offer or promotion conversation. Private to the member.

export type BenefitsAnswers = {
  wantsHealthDentalVisionInsurance: boolean | null
  wantsDisabilityInsurance: boolean | null
  wants401kMatch: boolean | null
  ptoWeeksExpected: number | null
  remoteDaysPerWeekDesired: number | null
  paidParentalLeaveWeeksExpected: number | null
  wantsProfessionalDevReimbursement: boolean | null
  wantsCommuterBenefits: boolean | null
  wantsGymMembership: boolean | null
}

export function benefitsAsks(a: BenefitsAnswers): string[] {
  const out: string[] = []
  if (a.wantsHealthDentalVisionInsurance) out.push('Health, dental and vision insurance')
  if (a.wantsDisabilityInsurance) out.push('Disability insurance')
  if (a.wants401kMatch) out.push('A 401(k) match')
  if (a.ptoWeeksExpected && a.ptoWeeksExpected > 0) out.push(`${a.ptoWeeksExpected} weeks of paid time off`)
  if (a.remoteDaysPerWeekDesired !== null && a.remoteDaysPerWeekDesired > 0) out.push(`${a.remoteDaysPerWeekDesired} remote ${a.remoteDaysPerWeekDesired === 1 ? 'day' : 'days'} a week`)
  if (a.paidParentalLeaveWeeksExpected && a.paidParentalLeaveWeeksExpected > 0) out.push(`${a.paidParentalLeaveWeeksExpected} weeks of paid parental leave`)
  if (a.wantsProfessionalDevReimbursement) out.push('Professional development reimbursement')
  if (a.wantsCommuterBenefits) out.push('Commuter benefits')
  if (a.wantsGymMembership) out.push('A gym membership')
  return out
}
