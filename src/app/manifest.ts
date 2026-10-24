import type { MetadataRoute } from 'next'

// Lets an installed copy of the site appear in a phone's share sheet: sharing a conference link opens Quick Add.
// (Android Chrome supports this for installed web apps; iPhone does not, so there the link is pasted.)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NextChapter',
    short_name: 'NextChapter',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    share_target: { action: '/dashboard/conferences/add', method: 'GET', params: { title: 'title', text: 'text', url: 'url' } },
  }
}
