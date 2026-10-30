// Opens Gmail's own web compose (not a bare mailto:, which hands off to
// whatever mail client the OS has set as default) prefilled with the
// recipient, subject, and optional body. `account` picks which signed-in Gmail
// account composes (Gmail's authuser), so a link opened by someone signed in to
// several accounts starts from the right sender. A link with an account is a CRM
// Write email link; it carries nc=dock so the NextChapter Capture extension can
// move the message into an open Gmail tab's small New Message window.
export function gmailComposeHref(to: string, subject: string, body?: string, account?: string): string {
  const params = new URLSearchParams({ view: 'cm', fs: '1', to, su: subject })
  if (account) {
    params.set('authuser', account)
    params.set('nc', 'dock')
  }
  if (body) params.set('body', body)
  return `https://mail.google.com/mail/?${params.toString()}`
}
