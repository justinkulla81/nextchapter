'use server'

import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/http/client-ip'
import { allowByIp, allowByTarget, DAY_MS, HOUR_MS } from '@/lib/security/rate-limit'
import { captureServerEvent } from '@/lib/posthog/server'
import { createResend, isUndeliverableAddress } from '@/lib/email/resend-client'
import { getTitleIndex, hasSalaryPage } from '@/lib/seo/job-titles'
import { usd } from '@/lib/seo/job-title-rules'
import { evaluatePay, parseAnnualPay, payCheckSentence, type PayCheckStat } from '@/lib/tools/pay-check'
import { payCheckEmailsOn } from '@/lib/leads/job-alert-config'
import { sentToday } from '@/lib/leads/job-alerts'
import { jobAlertDailyCap } from '@/lib/leads/job-alert-config'
import PayCheckResultEmail from '@/emails/pay-check-result'

// The pay check on /tools/pay-check: a title and an annual figure in, a plain comparison out, no account and no AI.
// Optionally the result by email, which also puts the person on the lead path (the journey question).

export interface PayCheckState {
  error?: string
  result?: { slug: string; name: string; sentence: string; p25: number; median: number; p75: number; payCount: number; pay: number; verdict: string }
  /** After the email box: the token that ties the journey choice to this person. */
  token?: string
  emailed?: boolean
  email?: string
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'
const text = (formData: FormData, k: string, max: number) => ((formData.get(k) as string | null) ?? '').trim().slice(0, max)

// `key` is a title slug (from the result forms) or a title as typed (from the first form).
async function statFor(key: string): Promise<PayCheckStat | null> {
  const k = key.trim().toLowerCase()
  const t = (await getTitleIndex()).find((x) => x.slug === k || x.name.toLowerCase() === k)
  if (!t || !hasSalaryPage(t)) return null
  return { name: t.name, slug: t.slug, payCount: t.payCount, p25: t.p25!, median: t.median!, p75: t.p75! }
}

export async function runPayCheck(_prev: PayCheckState | undefined, formData: FormData): Promise<PayCheckState> {
  const pay = parseAnnualPay(text(formData, 'pay', 20))
  if (pay == null) return { error: 'Enter your yearly pay, like 120000 or 120k.' }
  if (!(await allowByIp('pay-check', 60, HOUR_MS))) return { error: 'Too many checks from this network. Try again later.' }
  const stat = await statFor(text(formData, 'title', 100))
  if (!stat) return { error: 'Pick a job title from the list.' }
  const r = evaluatePay(pay, stat)
  if (!r) return { error: 'Something went wrong. Try again.' }
  captureServerEvent(await anon(), 'pay_check_run', { title: stat.slug, verdict: r.verdict, band: r.band })
  return { result: { slug: stat.slug, name: stat.name, sentence: payCheckSentence(pay, stat, r), p25: stat.p25, median: stat.median, p75: stat.p75, payCount: stat.payCount, pay, verdict: r.verdict } }
}

// No person is identified at this step, so each check gets its own throwaway id.
async function anon(): Promise<string> {
  return `pay-check-${crypto.randomUUID()}`
}

export async function emailPayCheck(prev: PayCheckState | undefined, formData: FormData): Promise<PayCheckState> {
  const base: PayCheckState = { result: prev?.result }
  if (text(formData, 'website', 200)) return { ...base, token: 'x', emailed: false }
  const email = text(formData, 'email', 200).toLowerCase()
  if (!EMAIL.test(email)) return { ...base, error: 'Enter a valid email address.', email }
  const pay = parseAnnualPay(text(formData, 'pay', 20))
  const stat = await statFor(text(formData, 'title', 100))
  if (pay == null || !stat) return { ...base, error: 'Run the check again, then ask for the email.', email }
  if (!(await allowByIp('pay-check-email', 10, HOUR_MS)) || !(await allowByTarget('pay-check-email', email, 5, DAY_MS))) {
    return { ...base, error: 'Too many requests from this network. Try again later.', email }
  }
  const r = evaluatePay(pay, stat)!
  try {
    const ip = await getClientIp()
    const key = { email, kind: 'pay_check', situation: '', searchQ: stat.slug, searchLoc: '', searchRemote: false }
    const select = { id: true, unsubscribeToken: true, planSentAt: true } as const
    const existing = await prisma.homepageLead.findUnique({ where: { email_kind_situation_searchQ_searchLoc_searchRemote: key }, select })
    const lead = existing
      ? await prisma.homepageLead.update({ where: { id: existing.id }, data: { unsubscribedAt: null, followup: r.verdict }, select })
      : await prisma.homepageLead.create({ data: { ...key, source: 'pay_check', followup: r.verdict, ip }, select })

    let emailed = false
    if (payCheckEmailsOn() && !lead.planSentAt && process.env.RESEND_API_KEY && !isUndeliverableAddress(email) && (await sentToday()) < jobAlertDailyCap()) {
      const unsubscribeUrl = `${APP_URL()}/api/unsubscribe/lead/${lead.unsubscribeToken}`
      try {
        const { error } = await createResend(process.env.RESEND_API_KEY, 'candidate').emails.send({
          from: 'NextChapter <support@launchyournextchapter.com>',
          replyTo: 'support@launchyournextchapter.com',
          to: email,
          subject: `Your pay check: ${stat.name}`,
          react: PayCheckResultEmail({
            title: stat.name,
            sentence: payCheckSentence(pay, stat, r),
            rangeLine: `Middle half of listings: ${usd(stat.p25)} to ${usd(stat.p75)}, from ${stat.payCount.toLocaleString('en-US')} listings that state pay.`,
            salaryUrl: `${APP_URL()}/salaries/${stat.slug}`,
            startUrl: `${APP_URL()}/api/job-alerts/journey/${lead.unsubscribeToken}?p=thinking-about-a-move&via=email`,
            unsubscribeUrl,
          }),
          headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>` },
        })
        if (!error) {
          await prisma.homepageLead.update({ where: { id: lead.id }, data: { planSentAt: new Date(), lastAlertAt: new Date() } })
          emailed = true
        } else console.error('pay check email failed:', error)
      } catch (e) {
        console.error('pay check email failed:', e)
      }
    }
    captureServerEvent(email, 'lead_captured', { kind: 'pay_check', source: 'pay_check', title: stat.slug, verdict: r.verdict, emailed, returning: !!existing })
    return { ...base, token: lead.unsubscribeToken, emailed, email }
  } catch (error) {
    console.error('pay check lead failed:', error instanceof Error ? error.message : error)
    return { ...base, error: 'Something went wrong. Try again in a minute.', email }
  }
}
