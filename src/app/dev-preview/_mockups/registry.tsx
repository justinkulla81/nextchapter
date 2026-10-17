import type { ComponentType } from 'react'
import { HomeToday, ProgressBuilt, ProgressTimeline } from './home'
import { NetworkOverviewMock, CloseCircle } from './network'

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
]

export const mockupFor = (path: string) => MOCKUPS.find((m) => m.path === path)
