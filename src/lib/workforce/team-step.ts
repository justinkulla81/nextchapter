// Admin › Overview launch checklist: the "Invite your team" step.
//
// A new portal already has one staff seat, the person who claimed it (provisionFreeWorkspace), so the step is done only when
// someone other than the signed-in administrator holds an active seat. The free plan has one administrator and no other staff
// roles (entitlements: adminLimit 1, staffRoles false), so there the step says so and points at the plan on the Staff page.

export type TeamStep = { done: boolean; label: string; detail: string; href: string }

export function teamStep(args: { otherStaff: number; staffRoles: boolean; base: string }): TeamStep {
  const href = `${args.base}/admin/users`
  if (args.otherStaff > 0) {
    return { done: true, label: 'Invite your team', detail: `${args.otherStaff} ${args.otherStaff === 1 ? 'colleague has' : 'colleagues have'} a seat.`, href }
  }
  if (!args.staffRoles) {
    return { done: false, label: 'Invite your team', detail: 'The free plan has one administrator. Inviting colleagues is part of the paid plan.', href }
  }
  return { done: false, label: 'Invite your team', detail: 'Program staff, business services, your career center.', href }
}
