# Monthly Update and mailing lists

Admin → Ecosystem → **Monthly Update** (`/support/admin/crm/mailing`).

- **Lists** (`MailingList`, `MailingListMember`): six seeded (monthly_update,
  investors, candidates, leads, customers, ecosystem); add, rename or archive
  them under *Lists and sender settings*. A person can be on several lists;
  unsubscribing is per list. A bounce or spam complaint suppresses the
  address on every list (`MailingSuppression`).
- **Editions** (`MailingEdition`, `MailingEditionRecipient`): one email to one
  or more lists. Someone on two targeted lists gets one email. The roster
  is the lists' ACTIVE members, minus anyone unchecked, plus anyone added
  for this send. It's stored, and it's frozen once sending starts.
- **Report receipts** (`CrmReportSend`): who got which report month, sent by
  the system (✉︎) or by hand (✋). Manual sends are detected by the Gmail
  sync from a `displacement-report-*.pdf` /
  `NextChapter-Displacement-Report-*.pdf` attachment or a
  `launchyournextchapter.com/reports/…` link.
- **"Add to a mailing list?"** (`MailingListPrompt`): raised by the Gmail
  sync after an email you sent someone who isn't on the lists that fit them.
  Shown on the CRM home and at `/crm/mailing/queue`.
- **Unsubscribe replies** (`MailingUnsubscribeRequest`): an inbound reply
  that's just "unsubscribe" / "remove" (or the List-Unsubscribe mailto) is
  queued under *Process unsubscribes*. The law allows 10 business days to
  apply it, and the queue flags anything older than 5.

Website signups still write `NewsletterSubscriber` (the weekly email). The
send cron and every roster build copy them into the Monthly Update list, so
the signup boxes need no change. An unsubscribe recorded there carries over.

## One-time setup

1. **Database**: apply `prisma/sql/2026-10-07-mailing-lists.sql` (additive;
   it also seeds the lists and copies existing signups in).
2. **Sending subdomain in Resend**: add `updates.launchyournextchapter.com`
   as a domain, put its DNS records at the registrar, and verify it. Keeping
   list mail on a subdomain protects the main domain's reputation. Until it
   verifies, set *From address* to `justin@launchyournextchapter.com` in
   sender settings.
3. **Open and click tracking**: Resend → Domains → updates.… → turn on Open
   tracking and Click tracking. Leave them off on the root domain, so
   transactional mail isn't rewritten.
4. **Webhook**: Resend → Webhooks → add
   `https://launchyournextchapter.com/api/webhooks/resend` with
   `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`,
   `email.complained`, `email.delivery_delayed`. Put the signing secret in
   Vercel as `RESEND_WEBHOOK_SECRET`.
5. **Unsubscribe link secret**: set `MAILING_UNSUBSCRIBE_SECRET` in Vercel (any
   long random string). It falls back to `CRON_SECRET`, but rotating that
   would break old unsubscribe links.
6. **Postal address**: set it in sender settings. Real sends are blocked
   until it's set (CAN-SPAM).

## Backfill

`scripts/backfill-report-sends-2026-09.ts` marks September's manual sends
(run with `--dry-run` first).
