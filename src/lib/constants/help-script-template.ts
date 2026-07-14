export function fillHelpScriptTemplate(candidate: { targetRoleType: string | null }): string {
  const role = candidate.targetRoleType ?? 'a new role'

  return `Hi [Name] — hope you've been well. I'm in the middle of a search for ${role} roles and wanted to reach out because I really respect your perspective.

Would you have 15 minutes in the next week or two to chat? I'd love to hear how things are going for you, and if anything comes to mind — a role, a company, or just someone else I should talk to — I'd really appreciate the pointer. No pressure at all if timing's not right.

Thanks either way — talk soon.`
}
