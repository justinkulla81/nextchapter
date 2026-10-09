import 'server-only'
import { Resend } from 'resend'
import { ADMIN_NOTIFICATION_EMAIL } from '@/lib/admin/auth'
import type { RapSheetContent, RapSheetMeta } from './types'

const APP = () => process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
export const rapSheetRecipient = () => ADMIN_NOTIFICATION_EMAIL

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const when = (d: Date | null) => (d ? d.toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: '2-digit' }) + ' ET' : '')
const link = (url: string | null, text: string) => (url && /^https?:\/\//.test(url) ? `<a href="${esc(url)}" style="color:#1d4ed8">${esc(text)}</a>` : esc(text))
const h = (t: string) => `<h2 style="font-size:15px;margin:22px 0 6px;color:#111">${esc(t)}</h2>`
const ul = (items: string[]) => (items.length ? `<ul style="margin:4px 0 0;padding-left:18px">${items.map((i) => `<li style="margin:3px 0">${i}</li>`).join('')}</ul>` : '')
const wrap = (inner: string) => `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#222;max-width:640px">${inner}</div>`

export function renderRapSheetHtml(c: RapSheetContent, m: RapSheetMeta): string {
  const none = '<p style="margin:4px 0;color:#666">Nothing found.</p>'
  return wrap(`
    <p style="margin:0;color:#666;font-size:12px">${esc(when(m.meetingAt))}${m.meetingTitle ? ` · ${esc(m.meetingTitle)}` : ''}</p>
    <h1 style="font-size:20px;margin:2px 0 4px">${esc(m.personName)}${m.orgName ? ` — ${esc(m.orgName)}` : ''}</h1>
    <p style="margin:0 0 6px">${esc(c.headline)}</p>
    <p style="margin:0">${esc(c.whoTheyAre)}</p>
    ${h('The pitch')}
    <p style="margin:0 0 6px"><b>${esc(c.pitch.angle)}</b></p>
    ${ul(c.pitch.howItHelps.map(esc))}
    ${c.pitch.openingLine ? `<p style="margin:10px 0 0"><b>Open with:</b> ${esc(c.pitch.openingLine)}</p>` : ''}
    ${c.pitch.ask ? `<p style="margin:6px 0 0"><b>The ask:</b> ${esc(c.pitch.ask)}</p>` : ''}
    ${c.pitch.objections.length ? `<p style="margin:10px 0 2px"><b>Likely pushback</b></p>${ul(c.pitch.objections.map((o) => `<i>${esc(o.objection)}</i> ${esc(o.response)}`))}` : ''}
    ${h('Our history with them')}${c.relationship.length ? ul(c.relationship.map(esc)) : '<p style="margin:4px 0;color:#666">No logged history.</p>'}
    ${h('Local picture')}<p style="margin:0">${esc(c.local.summary)}</p>${ul(c.local.points.map(esc))}
    ${h('Layoffs')}<p style="margin:0">${esc(c.layoffs.summary)}</p>${c.layoffs.items.length ? ul(c.layoffs.items.map((i) => `<b>${esc(i.employer)}</b>${i.date ? ` (${esc(i.date)})` : ''}: ${esc(i.detail)}${i.sourceUrl ? ` · ${link(i.sourceUrl, 'source')}` : ''}`)) : none}
    ${h('Initiatives')}${c.initiatives.length ? ul(c.initiatives.map((i) => `<b>${esc(i.name)}:</b> ${esc(i.detail)}${i.sourceUrl ? ` · ${link(i.sourceUrl, 'source')}` : ''}`)) : none}
    ${h('White-collar metrics')}${c.whiteCollar.length ? ul(c.whiteCollar.map((w) => `<b>${esc(w.metric)}:</b> ${esc(w.value)} — ${esc(w.context)}${w.sourceUrl ? ` · ${link(w.sourceUrl, 'source')}` : ''}`)) : none}
    ${c.caveats.length ? `${h('Could not confirm')}${ul(c.caveats.map(esc))}` : ''}
    ${c.sources.length ? `${h('Sources')}${ul(c.sources.map((s) => link(s.url, s.title || s.url)))}` : ''}
    <p style="margin:22px 0 0"><a href="${APP()}/support/admin/crm/people/${m.personId}" style="color:#1d4ed8">Open in CRM</a></p>
  `)
}

async function send(subject: string, html: string): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) { console.warn('RESEND_API_KEY is not set — skipping meeting brief email.'); return false }
  try {
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>', to: rapSheetRecipient(), subject, html,
    })
    if (error) { console.error('Meeting brief email failed:', error); return false }
    return true
  } catch (e) {
    console.error('Meeting brief email failed:', e)
    return false
  }
}

export const sendRapSheetEmail = (c: RapSheetContent, m: RapSheetMeta) =>
  send(`Meeting brief: ${m.personName}${m.orgName ? ` (${m.orgName})` : ''}${m.meetingAt ? ` — ${when(m.meetingAt)}` : ''}`, renderRapSheetHtml(c, m))

export interface OfferRow { personId: string; personName: string; orgName: string | null; title: string | null; at: Date; role: string | null }

/** The night-before email: tomorrow's pitches, with one button to choose which get a meeting brief. */
export function sendOfferEmail(rows: OfferRow[], unknown: { email: string; name: string | null; at: Date }[]): Promise<boolean> {
  const url = `${APP()}/support/admin/crm/rap-sheets`
  const items = rows.map((r) => `<b>${esc(r.personName)}</b>${r.orgName ? `, ${esc(r.orgName)}` : ''} · ${esc(when(r.at))}${r.title ? ` · ${esc(r.title)}` : ''}`)
  const miss = unknown.map((u) => `${esc(u.name || u.email)} (${esc(u.email)}) · ${esc(when(u.at))}`)
  return send(`Which pitches tomorrow get a meeting brief? (${rows.length})`, wrap(`
    <h1 style="font-size:18px;margin:0 0 6px">Tomorrow's pitches</h1>
    ${ul(items)}
    <p style="margin:16px 0"><a href="${url}" style="background:#1d4ed8;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block">Choose meeting briefs</a></p>
    <p style="margin:0;color:#666">Each one you include is a small research run (cheapest model, 5 searches). Anything you leave alone is skipped. Included sheets arrive by email at 6:30 AM ET.</p>
    ${miss.length ? `${h('On your calendar but not in the CRM')}${ul(miss)}<p style="margin:4px 0;color:#666">Add them to the CRM to get a meeting brief offer.</p>` : ''}
  `))
}

/** Tells Justin the night-before job could not read his calendar, so he is not left waiting for briefs that will never come. */
export function sendOfferProblemEmail(reason: string, detail?: string): Promise<boolean> {
  const connect = `${APP()}/api/admin/google-calendar/connect`
  return send('Meeting brief offers did not run: reconnect your calendar', wrap(`
    <h1 style="font-size:18px;margin:0 0 6px">Tomorrow's meeting brief offers did not run</h1>
    <p style="margin:0 0 8px">${esc(reason)}</p>
    ${detail ? `<p style="margin:0 0 8px;color:#666">${esc(detail)}</p>` : ''}
    <p style="margin:16px 0"><a href="${connect}" style="background:#1d4ed8;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block">Reconnect Google Calendar</a></p>
    <p style="margin:0;color:#666">Until you do, no meeting brief offers are sent. You can still build one by hand from the person's CRM page.</p>
  `))
}
