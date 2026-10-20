// The headline and the one line under it for each part of Find a job (the mockups' page headers). The Jobs part keeps
// "Find a job"; the others name what they are, so each view has one headline.

export type FindPartKey = 'jobs' | 'unposted' | 'independent' | 'resources'

export const FIND_PART_HEADER: Record<FindPartKey, { title: string; intro: string }> = {
  jobs: { title: 'Find a job', intro: 'Roles that fit your background. For each one, we tell you why.' },
  unposted: { title: 'Not posted yet', intro: 'Openings that public filings and news point to before a job is posted, with who you know at each.' },
  independent: { title: 'Independent work', intro: 'Consulting, fractional and advisory work, on your terms, alongside your search or instead of it.' },
  resources: { title: 'Resources', intro: 'Places to look, who can see your résumé, and short guides.' },
}
