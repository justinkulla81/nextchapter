// A time-sensitive lead: something due or owed. On days the weekly rotation
// email already goes out (and for Essentials members) Job Search Daily only
// sends when its top priority is one of these.
export const URGENT_LEAD =
  /^(Today|Tomorrow|Overdue|Waiting|Reply today|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/

export function isUrgentContent(content: { priorities: { lead: string }[] }): boolean {
  const top = content.priorities[0]
  return !!top && URGENT_LEAD.test(top.lead)
}
