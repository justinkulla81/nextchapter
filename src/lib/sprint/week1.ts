// Week 1's Search Sprint is replaced entirely by a fixed 5-artifact
// checklist instead of the usual pick-your-own-actions plan — a brand new
// candidate doesn't have enough signal yet to know what to commit to, and
// producing these 5 real things is more valuable than an arbitrary points
// target. Completion is derived from existing signals (never a new
// tracking table) so nothing can drift out of sync with the real data.

export interface Week1ArtifactContext {
  linkedInPosted: boolean
  coverLetterGenerated: boolean
  narrativeGenerated: boolean
  outreachLogged: boolean
}

export interface Week1Artifact {
  id: string
  label: string
  description: string
  href: string
  complete: boolean
}

export function getWeek1Artifacts(context: Week1ArtifactContext): Week1Artifact[] {
  return [
    {
      id: 'linkedin-post',
      label: 'Post on LinkedIn',
      description: 'Share something real — an update, a lesson, a project. Visibility compounds.',
      href: '/dashboard/linkedin',
      complete: context.linkedInPosted,
    },
    {
      id: 'cover-letter',
      label: 'Generate a cover letter',
      description: 'Paste in a real posting and get one tailored to it.',
      href: '/dashboard/job-fit',
      complete: context.coverLetterGenerated,
    },
    {
      id: 'core-narrative',
      label: 'Write your core narrative',
      description: 'The 2-3 sentence version of your story everything else adapts from.',
      href: '/dashboard/interview-prep',
      complete: context.narrativeGenerated,
    },
    {
      id: 'elevator-pitch',
      label: 'Get your elevator pitch',
      description: 'A ready 30-second version of your narrative, generated alongside it.',
      href: '/dashboard/interview-prep',
      complete: context.narrativeGenerated,
    },
    {
      id: 'outreach-email',
      label: 'Send one outreach message',
      description: 'Reach out to a real contact — the first one is the hardest.',
      href: '/dashboard/network',
      complete: context.outreachLogged,
    },
  ]
}
