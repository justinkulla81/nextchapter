// Job alert emails are off until the owner turns them on: with JOB_ALERT_EMAILS unset, a saved search is stored
// and nothing is sent. The daily cron then only reports who would get an email.
export const jobAlertEmailsOn = () => process.env.JOB_ALERT_EMAILS === '1'

// One slice of the Resend plan's shared daily volume, so alerts can never crowd out the digests.
export const jobAlertDailyCap = () => {
  const n = Number(process.env.JOB_ALERT_DAILY_CAP)
  return Number.isFinite(n) && n >= 0 ? n : 100
}

export const JOB_ALERT_MAX_JOBS = 5

// Layoff watch emails (a layoff notice at an employer or in a state) have their own switch, off by default.
export const layoffAlertEmailsOn = () => process.env.LAYOFF_ALERT_EMAILS === '1'

// The one result email after a pay check (when someone asks for it). Off by default, like the others.
export const payCheckEmailsOn = () => process.env.PAY_CHECK_EMAIL === '1'

// Deadline reminder emails after a layoff. Off by default.
export const deadlineEmailsOn = () => process.env.DEADLINE_REMINDER_EMAILS === '1'
