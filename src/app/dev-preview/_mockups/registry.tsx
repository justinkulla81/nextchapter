import type { ComponentType } from 'react'
import { HomeToday, ProgressBuilt, ProgressTimeline } from './home'
import { NetworkOverviewMock, CloseCircle } from './network'
import { FindJobs } from './jobs-find'
import { FindUnposted, FindIndependent, FindResources, MyJobs, Companies, CompanyProfile, MarketYours, MarketPay, MarketLocal, MarketPivot, Interviews, Offers } from './jobs-more'
import { PeopleYouKnow, AlumniGroups, IndustryFunction, RecruitersCircle, NetworkThisWeek, Messages } from './network-more'
import { LearnSkills, LearnVideos, ProfileMock, ResumeMock, WhyHireMe, CareerStory, HowIWork, MySearch, WhatRecruitersSee, DocumentsMock, MembershipMock, HelpTalk, HelpMoney, HelpScams, HelpQuestions } from './learn-help'
import { HomeEntrepreneur, HomeTimeOff, HomeCareerChange, HomeFractional, HomeStalled, CheckIn, TailoredForYou } from './personalization'
import { TuneQuestion, TuneDone, DeepDiveIntro } from './questionnaire'

export interface Mockup {
  /** The address after /dev-preview/. */
  path: string
  place: string
  title: string
  /** The live page(s) this replaces or absorbs. */
  replaces: string
  Component: ComponentType
}

export const MOCKUPS: Mockup[] = [
  { path: 'home/today', place: 'Home', title: 'Your plan', replaces: '/dashboard', Component: HomeToday },
  { path: 'home/progress/built', place: 'Home', title: 'Momentum: what you’ve built', replaces: '/dashboard/stats (badges and leaderboards removed)', Component: ProgressBuilt },
  { path: 'home/progress/timeline', place: 'Home', title: 'Momentum: your search timeline', replaces: 'new', Component: ProgressTimeline },
  { path: 'network/circles/overview', place: 'Network', title: 'Your network: all circles', replaces: '/dashboard/network', Component: NetworkOverviewMock },
  { path: 'network/circles/close', place: 'Network', title: 'Close circle', replaces: '/dashboard/supporters, /dashboard/my-coaching', Component: CloseCircle },
  { path: 'jobs/find/jobs', place: 'Jobs', title: 'Find a job: list and detail', replaces: '/dashboard/find-my-job, /dashboard/jobs/ID', Component: FindJobs },
  { path: 'jobs/find/unposted', place: 'Jobs', title: 'Find a job: not posted yet', replaces: 'Likely openings on /dashboard/find-my-job', Component: FindUnposted },
  { path: 'jobs/find/independent', place: 'Jobs', title: 'Find a job: independent work', replaces: 'Independent work toolkit on /dashboard/find-my-job', Component: FindIndependent },
  { path: 'jobs/find/resources', place: 'Jobs', title: 'Find a job: resources', replaces: 'Job boards, résumé book, guides on /dashboard/find-my-job', Component: FindResources },
  { path: 'jobs/mine', place: 'Jobs', title: 'My jobs', replaces: '/dashboard/find-my-job?tab=my_jobs', Component: MyJobs },
  { path: 'jobs/companies', place: 'Jobs', title: 'Companies', replaces: '/dashboard/companies, /dashboard/company-tracker', Component: Companies },
  { path: 'jobs/companies/profile', place: 'Jobs', title: 'Company profile', replaces: '/dashboard/companies/[slug]', Component: CompanyProfile },
  { path: 'jobs/market/market', place: 'Jobs', title: 'Market: your market', replaces: '/dashboard/market, market-reality, market-intelligence', Component: MarketYours },
  { path: 'jobs/market/pay', place: 'Jobs', title: 'Market: know your worth', replaces: '/dashboard/pay', Component: MarketPay },
  { path: 'jobs/market/local', place: 'Jobs', title: 'Market: local market', replaces: '/dashboard/local-market', Component: MarketLocal },
  { path: 'jobs/market/pivot', place: 'Jobs', title: 'Market: other roles you could do', replaces: '/dashboard/pivot-paths, /dashboard/pivot', Component: MarketPivot },
  { path: 'jobs/interviews', place: 'Jobs', title: 'Interviews', replaces: '/dashboard/interview-prep, /dashboard/review-prep', Component: Interviews },
  { path: 'jobs/offers', place: 'Jobs', title: 'Offers', replaces: '/dashboard/got-hired, /dashboard/in-work', Component: Offers },
  { path: 'network/circles/know', place: 'Network', title: 'People you know', replaces: '/dashboard/network/contacts, /dashboard/references', Component: PeopleYouKnow },
  { path: 'network/circles/alumni', place: 'Network', title: 'Alumni and groups', replaces: '/dashboard/groups, /dashboard/universities, /dashboard/past-jobs', Component: AlumniGroups },
  { path: 'network/circles/industry', place: 'Network', title: 'Industry and function', replaces: '/dashboard/community', Component: IndustryFunction },
  { path: 'network/circles/recruiters', place: 'Network', title: 'Recruiters', replaces: '/dashboard/recruiter-requests', Component: RecruitersCircle },
  { path: 'network/week', place: 'Network', title: 'This week', replaces: '/dashboard/network/this-week, /dashboard/network/follow-ups', Component: NetworkThisWeek },
  { path: 'network/messages', place: 'Network', title: 'Messages', replaces: '/dashboard/messages', Component: Messages },
  { path: 'learn/learn/skills', place: 'Learn', title: 'Skills and courses', replaces: '/dashboard/learning', Component: LearnSkills },
  { path: 'learn/learn/videos', place: 'Learn', title: 'Videos and webinars', replaces: '/dashboard/webinars', Component: LearnVideos },
  { path: 'personalize/profile/profile', place: 'Personalize', title: 'Profile', replaces: '/dashboard/profile, complete-profile', Component: ProfileMock },
  { path: 'personalize/profile/resume', place: 'Personalize', title: 'Résumé', replaces: '/dashboard/resume, resume/studio, resume/walkthrough', Component: ResumeMock },
  { path: 'personalize/profile/whyhire', place: 'Personalize', title: 'Why hire me', replaces: '/dashboard/strengths, track-record', Component: WhyHireMe },
  { path: 'personalize/profile/career', place: 'Personalize', title: 'Career story', replaces: '/dashboard/my-career (other branch)', Component: CareerStory },
  { path: 'personalize/profile/work', place: 'Personalize', title: 'How I work', replaces: '/dashboard/skills-assessments, how-i-perform, work-interests', Component: HowIWork },
  { path: 'personalize/search', place: 'Personalize', title: 'My search', replaces: '/dashboard/search-strategy, what-i-need, marketing-plan', Component: MySearch },
  { path: 'personalize/recruiters', place: 'Personalize', title: 'What recruiters see', replaces: '/dashboard/recruiter-report, privacy', Component: WhatRecruitersSee },
  { path: 'personalize/documents', place: 'Personalize', title: 'Documents', replaces: '/dashboard/documents', Component: DocumentsMock },
  { path: 'personalize/membership', place: 'Personalize', title: 'Membership', replaces: '/dashboard/membership', Component: MembershipMock },
  { path: 'help/talk', place: 'Help', title: 'Talk to someone', replaces: '/dashboard/support', Component: HelpTalk },
  { path: 'help/money', place: 'Help', title: 'Money and benefits', replaces: '/dashboard/benefits, benefits-network', Component: HelpMoney },
  { path: 'help/scams', place: 'Help', title: 'Scam watch', replaces: '/dashboard/scam-watch', Component: HelpScams },
  { path: 'help/questions', place: 'Help', title: 'Questions and feedback', replaces: '/dashboard/help', Component: HelpQuestions },
  { path: 'home/tailored', place: 'Home', title: 'Improve your search', replaces: 'new: every personalization in one place', Component: TailoredForYou },
  { path: 'home/stalled', place: 'Home', title: 'Today: week 4, no interviews, widen the search', replaces: 'new: time-driven personalization', Component: HomeStalled },
  { path: 'home/checkin', place: 'Home', title: 'The check-in in three tones', replaces: 'mood pop-up and Still searching dialog, merged', Component: CheckIn },
  { path: 'home/journey/entrepreneur', place: 'Home', title: 'Today: building something of my own', replaces: '/dashboard for ENTREPRENEUR', Component: HomeEntrepreneur },
  { path: 'home/journey/time-off', place: 'Home', title: 'Today: taking time off', replaces: '/dashboard for TIME_OFF', Component: HomeTimeOff },
  { path: 'home/journey/career-change', place: 'Home', title: 'Today: changing careers', replaces: '/dashboard for CAREER_CHANGE', Component: HomeCareerChange },
  { path: 'home/journey/fractional', place: 'Home', title: 'Today: fractional and independent work', replaces: '/dashboard for FRACTIONAL', Component: HomeFractional },
  { path: 'flows/tune-question', place: 'Flows', title: 'A question, with the payoff shown', replaces: 'every one-off question on profile, search strategy, and onboarding', Component: TuneQuestion },
  { path: 'flows/tune-done', place: 'Flows', title: 'The finish: what you just gained', replaces: 'new', Component: TuneDone },
  { path: 'flows/deep-dive', place: 'Flows', title: 'A long assessment as short rounds', replaces: 'How I Work Best (57 items), What I Need (24), Track Record (19)', Component: DeepDiveIntro },
]

export const mockupFor = (path: string) => MOCKUPS.find((m) => m.path === path)
