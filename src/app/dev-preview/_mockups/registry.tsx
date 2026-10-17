import type { ComponentType } from 'react'
import { HomeToday, ProgressBuilt, ProgressTimeline } from './home'
import { NetworkOverviewMock, CloseCircle } from './network'
import { FindJobs } from './jobs-find'
import { FindUnposted, FindIndependent, FindResources, MyJobs, Companies, CompanyProfile, MarketYours, MarketPay, MarketLocal, MarketPivot, Interviews, Offers } from './jobs-more'

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
  { path: 'home/today', place: 'Home', title: 'Today', replaces: '/dashboard', Component: HomeToday },
  { path: 'home/progress/built', place: 'Home', title: 'Progress: what you’ve built', replaces: '/dashboard/stats (badges and leaderboards removed)', Component: ProgressBuilt },
  { path: 'home/progress/timeline', place: 'Home', title: 'Progress: your search timeline', replaces: 'new', Component: ProgressTimeline },
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
]

export const mockupFor = (path: string) => MOCKUPS.find((m) => m.path === path)
