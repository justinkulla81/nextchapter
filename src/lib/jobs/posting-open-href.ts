// Where "View posting" / apply on a crawled board job points: the click-time liveness check
// (src/app/dashboard/jobs/[id]/open/route.ts), which redirects to the employer's posting.
export function postingOpenHref(postingId: string): string {
  return `/dashboard/jobs/${encodeURIComponent(postingId)}/open`
}
