// Opens Gmail's own web compose (not a bare mailto:, which hands off to
// whatever mail client the OS has set as default) prefilled with the
// recipient, subject, and optional body.
export function gmailComposeHref(to: string, subject: string, body?: string): string {
  const params = new URLSearchParams({ view: 'cm', fs: '1', to, su: subject })
  if (body) params.set('body', body)
  return `https://mail.google.com/mail/?${params.toString()}`
}
