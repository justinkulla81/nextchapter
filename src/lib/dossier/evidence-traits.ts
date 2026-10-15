// The nine things a recruiter or hiring manager cares about and a CV cannot
// show, each read from something the member actually did. A level is 0 to 3:
// 0 not shown yet, 1 early, 2 emerging, 3 clear. Never a score and never a
// comparison with other people. The thresholds are product heuristics, kept in
// one table here so they can be tuned without touching any screen.

export type TraitKey = 'motivation' | 'thoroughness' | 'detail' | 'conscientiousness' | 'helpfulness' | 'communication' | 'references' | 'selfAware' | 'peaks'
export type TraitLevel = 0 | 1 | 2 | 3

export interface TraitSignals {
  effortMinutes: number
  /** Profile sections confirmed, 0 to 6. */
  profileSections: number
  /** Applications sent with a tailored cover letter. */
  tailoredApplications: number
  workSamples: number
  /** Consecutive recent weeks the weekly goal was met. */
  goalStreakWeeks: number
  /** Posts or replies that helped someone in a community. */
  helpfulPosts: number
  outreachCount: number
  completedReferences: number
  /** Behavioral assessments finished, 0 to 2. */
  behavioralAssessments: number
  skillsAssessmentDone: boolean
}

export interface EvidenceTrait {
  key: TraitKey
  label: string
  level: TraitLevel
  /** What it is shown by, in plain words. */
  shownBy: string
}

const at = (n: number, early: number, emerging: number, clear: number): TraitLevel => (n >= clear ? 3 : n >= emerging ? 2 : n >= early ? 1 : 0)

export function buildEvidenceTraits(s: TraitSignals): EvidenceTrait[] {
  const assessments = s.behavioralAssessments + (s.skillsAssessmentDone ? 1 : 0)
  const selfAware: TraitLevel = s.completedReferences >= 2 && assessments >= 2 ? 3 : s.completedReferences >= 1 && assessments >= 1 ? 2 : assessments >= 1 ? 1 : 0
  return [
    { key: 'motivation', label: 'Motivation', level: at(s.effortMinutes, 1, 150, 480), shownBy: 'The time you put into your search each week: applying, networking, learning, working.' },
    { key: 'thoroughness', label: 'Thoroughness', level: at(s.profileSections, 1, 3, 6), shownBy: 'Finishing things properly, like completing your profile.' },
    { key: 'detail', label: 'Attention to detail', level: at(s.tailoredApplications + s.workSamples, 1, 3, 6), shownBy: 'Tailored applications and work samples.' },
    { key: 'conscientiousness', label: 'Conscientiousness', level: at(s.goalStreakWeeks, 1, 2, 4), shownBy: 'A little most days, week after week.' },
    { key: 'helpfulness', label: 'Helpfulness', level: at(s.helpfulPosts, 1, 3, 8), shownBy: 'Helping others in your communities.' },
    { key: 'communication', label: 'Communication', level: at(s.outreachCount, 1, 5, 15), shownBy: 'The messages you send to real people.' },
    { key: 'references', label: 'References', level: at(s.completedReferences, 1, 2, 3), shownBy: 'People who vouch for you.' },
    { key: 'selfAware', label: 'Self-awareness', level: selfAware, shownBy: 'Your own view lining up with what your references and assessments show.' },
    { key: 'peaks', label: 'Peak strengths', level: at(assessments, 1, 2, 3), shownBy: 'What you are clearly best at, once your assessments are in.' },
  ]
}

export const TRAIT_LEVEL_LABEL: Record<TraitLevel, string> = { 0: 'Not shown yet', 1: 'Early', 2: 'Emerging', 3: 'Clear' }
