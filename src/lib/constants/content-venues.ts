import type { ContentVenue } from '@prisma/client'

export const CONTENT_VENUE_LABEL: Record<ContentVenue, string> = {
  LINKEDIN: 'LinkedIn',
  SUBSTACK: 'Substack / Whitepaper',
  CONFERENCES: 'Conferences',
  WEBINARS: 'Webinars',
  EXPERT_NETWORKS: 'Expert Networks',
  INSTAGRAM_FACEBOOK_YOUTUBE: 'Influencer Videos',
  PODCAST: 'Podcasts',
}

export const CONTENT_VENUE_OPTIONS: { value: ContentVenue; label: string }[] = [
  { value: 'LINKEDIN', label: CONTENT_VENUE_LABEL.LINKEDIN },
  { value: 'SUBSTACK', label: CONTENT_VENUE_LABEL.SUBSTACK },
  { value: 'CONFERENCES', label: CONTENT_VENUE_LABEL.CONFERENCES },
  { value: 'WEBINARS', label: CONTENT_VENUE_LABEL.WEBINARS },
  { value: 'EXPERT_NETWORKS', label: CONTENT_VENUE_LABEL.EXPERT_NETWORKS },
  { value: 'INSTAGRAM_FACEBOOK_YOUTUBE', label: CONTENT_VENUE_LABEL.INSTAGRAM_FACEBOOK_YOUTUBE },
  { value: 'PODCAST', label: CONTENT_VENUE_LABEL.PODCAST },
]

export const COMFORT_LEVEL_CHOICES = [
  { value: 100, label: 'Yes, I enjoy it' },
  { value: 60, label: "It's okay" },
  { value: 20, label: 'Not really my thing' },
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
    venue: 'CONFERENCES',
    tutorials: [
      {
        name: 'How to write a winning conference talk proposal',
        description: 'A practical guide to pitching and getting accepted to speak at industry events.',
        url: 'https://www.papercall.io/',
      },
    ],
  },
  {
    venue: 'WEBINARS',
    tutorials: [
      {
        name: 'How to host a webinar that people actually attend',
        description: 'Practical tips on structure, promotion, and follow-up for a first webinar.',
        url: 'https://blog.hubspot.com/marketing/how-to-do-a-webinar',
      },
    ],
  },
  {
    venue: 'EXPERT_NETWORKS',
    tutorials: [
      {
        name: 'How expert networks work (Coleman Research)',
        description: 'An overview of how to get listed and paid as an expert network consultant.',
        url: 'https://www.colemanrg.com/experts',
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
