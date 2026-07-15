interface TemplateContext {
  targetRoleType: string | null
}

export function fillIntroRequestTemplate(candidate: TemplateContext): string {
  const role = candidate.targetRoleType ?? 'a new role'

  return `Hi [Name] — hope you're doing well. I'm looking into ${role} opportunities, and I noticed you're connected to [Person/Company] on LinkedIn.

Would you be open to a quick intro? Totally fine to just forward my note along, or let me know if now isn't a good time to ask.

Thanks so much — I really appreciate it.`
}

export function fillGoodWordTemplate(candidate: TemplateContext): string {
  const role = candidate.targetRoleType ?? 'this role'

  return `Hi [Name] — hope all is well. I saw that [Company] has an opening for ${role}, and I understand you know [Hiring Manager]. I'm genuinely excited about the role and think my background could be a strong fit.

Would you be willing to put in a good word, or let me know the best way to get in front of them? Happy to send over my resume or a quick summary of why I think it's a good match.

Thank you either way — I know these asks aren't always easy.`
}

export function fillCheckingInTemplate(candidate: TemplateContext): string {
  const role = candidate.targetRoleType ?? 'a role'

  return `Hi [Name] — it's been a bit since we last talked. I'm still searching for ${role} opportunities, and given how things are going, I've also started looking at interim or contract work to bridge the gap.

If you hear of anything — full-time or interim — I'd really appreciate you thinking of me. Would also love to catch up properly sometime soon.

Hope you're doing well.`
}
