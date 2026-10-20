// Why a note to someone inside is worth sending, with the sources. One stat per
// email, rotated so the same person doesn't read the same line every time. Every
// figure here is attributed and phrased as the source reports it; add a new one
// only with a source you have read, and keep the wording to what it says.
export interface BackchannelStat {
  text: string
  source: string
  url: string
}

export const BACKCHANNEL_STATS: BackchannelStat[] = [
  {
    text: 'In an analysis of about 4 million candidates, 1 in 16 referred candidates was hired, compared with 1 in 152 who applied through a careers site or job posting.',
    source: 'Lever, via SHRM',
    url: 'https://shrm.org/topics-tools/news/talent-acquisition/lever-study-shows-1-100-candidates-hired',
  },
  {
    text: 'At one large financial services firm, referrals were about 6% of applications but more than a quarter of hires.',
    source: 'New York Fed and MIT study, via Quartz',
    url: 'https://qz.com/299923/why-job-referrals-matter',
  },
  {
    text: 'A study of 20 million LinkedIn users found that people you know a little were more likely to lead to a new job than close friends. You don’t need to be close.',
    source: 'MIT and LinkedIn study, via MIT News',
    url: 'https://news.mit.edu/2022/weak-ties-linkedin-employment-0915',
  },
]

// `sentBefore` is how many of these emails the candidate has already received,
// so consecutive emails always show a different stat.
export function pickBackchannelStat(sentBefore: number): BackchannelStat {
  return BACKCHANNEL_STATS[((sentBefore % BACKCHANNEL_STATS.length) + BACKCHANNEL_STATS.length) % BACKCHANNEL_STATS.length]
}
