// Job alert emails are off until the owner turns them on: with JOB_ALERT_EMAILS unset, a saved search is stored
// and nothing is sent. The daily cron then only reports who would get an email.
export const jobAlertEmailsOn = () => process.env.JOB_ALERT_EMAILS === '1'

// One slice of the Resend plan's shared daily volume, so alerts can never crowd out the digests.
export const jobAlertDailyCap = () => {
  const n = Number(process.env.JOB_ALERT_DAILY_CAP)
  return Number.isFinite(n) && n >= 0 ? n : 100
}

export const JOB_ALERT_MAX_JOBS = 5
