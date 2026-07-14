import type { ContentVenue } from '@prisma/client'

export const CONTENT_VENUE_LABEL: Record<ContentVenue, string> = {
  LINKEDIN: 'LinkedIn',
  SUBSTACK: 'Substack / newsletter',
  PODCAST: 'Podcast',
  INSTAGRAM_FACEBOOK_YOUTUBE: 'Instagram / Facebook / YouTube',
}

export const CONTENT_VENUE_OPTIONS: { value: ContentVenue; label: string }[] = [
  { value: 'LINKEDIN', label: CONTENT_VENUE_LABEL.LINKEDIN },
  { value: 'SUBSTACK', label: CONTENT_VENUE_LABEL.SUBSTACK },
  { value: 'PODCAST', label: CONTENT_VENUE_LABEL.PODCAST },
  { value: 'INSTAGRAM_FACEBOOK_YOUTUBE', label: CONTENT_VENUE_LABEL.INSTAGRAM_FACEBOOK_YOUTUBE },
]

export const COMFORT_LEVEL_CHOICES = [
  { value: 10, label: 'Not at all — this feels exposing' },
  { value: 40, label: "A little uneasy, but I'll try" },
  { value: 70, label: 'Fairly comfortable' },
  { value: 100, label: 'I already do this / love it' },
] as const

interface Tutorial {
  name: string
  description: string
  url: string
}

export const CONTENT_TUTORIALS: { venue: ContentVenue; tutorials: Tutorial[] }[] = [
  {
    venue: 'LINKEDIN',
    tutorials: [
      {
        name: 'LinkedIn\'s own creator guide',
        description: 'Official tips on post formatting, hooks, and posting cadence.',
        url: 'https://www.linkedin.com/business/marketing/blog/linkedin-tips/tips-for-writing-linkedin-posts',
      },
      {
        name: 'Justin Welsh — LinkedIn Operating System',
        description: 'Widely-referenced free playbook for building a personal brand on LinkedIn.',
        url: 'https://www.justinwelsh.me/newsletter',
      },
    ],
  },
  {
    venue: 'SUBSTACK',
    tutorials: [
      {
        name: 'Substack — Getting Started guide',
        description: "Substack's own guide to launching and growing a newsletter.",
        url: 'https://on.substack.com/',
      },
    ],
  },
  {
    venue: 'PODCAST',
    tutorials: [
      {
        name: 'Podcasting for beginners (Buzzsprout)',
        description: 'Practical, free walkthrough of recording and publishing your first episode.',
        url: 'https://www.buzzsprout.com/blog/podcasting-for-beginners',
      },
    ],
  },
  {
    venue: 'INSTAGRAM_FACEBOOK_YOUTUBE',
    tutorials: [
      {
        name: 'YouTube Creator Academy',
        description: "YouTube's own free courses on planning, filming, and growing a channel.",
        url: 'https://creatoracademy.youtube.com/',
      },
    ],
  },
]
