// Admin › Overview launch checklist: the "Invite your team" step.
//
// A new portal already has one staff seat, the person who claimed it (provisionFreeWorkspace), so the step is done only when
// someone other than the portal's administrator holds an active seat. The free plan has one administrator and no other staff
// roles (entitlements: adminLimit 1, staffRoles false), so there the step says so and points at the plan on the Staff page.

export type TeamStep = { done: boolean; label: string; detail: string; href: string }

// Which active seats count as "your team". The viewer's own seats (by login or invited email) never count. A viewer with no
// seat here (NextChapter support in a View-as or a demo) is not the administrator, so the founding administrator's seat, the
// oldest active INSTITUTION_ADMIN, is left out instead.
export function teamSeatWhere(args: { institutionId: string; userId: string; email: string | null; viewerSeats: number; foundingAdminId: string | null }) {
  return {
    institutionId: args.institutionId,
    revokedAt: null,
    AND: [
      { OR: [{ userId: null }, { userId: { not: args.userId } }] },
      { invitedEmail: { not: args.email ?? '', mode: 'insensitive' as const } },
      ...(args.viewerSeats === 0 && args.foundingAdminId ? [{ id: { not: args.foundingAdminId } }] : []),
    ],
  }
}

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
