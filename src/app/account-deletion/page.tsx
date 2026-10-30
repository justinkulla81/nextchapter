import type { Metadata } from 'next'
import { SeoPage, H2 } from '@/components/seo/SeoPage'
import { titleMeta } from '@/lib/seo/title'

export const metadata: Metadata = {
  title: titleMeta('Delete your NextChapter account'),
  description: 'How to delete your NextChapter account and data, from the app, the website or by email.',
  alternates: { canonical: '/account-deletion' },
}

export default function AccountDeletionPage() {
  return (
    <SeoPage
      trail={[{ name: 'Delete your account', path: '/account-deletion' }]}
      h1="Delete your NextChapter account"
      lede={<p className="max-w-2xl text-base">You can ask us to delete your account and the data tied to it at any time.</p>}
    >
      <h2 className={H2}>In the app</h2>
      <p>Open the Saved tab, sign in, and choose Delete my account. Enter your password and type DELETE.</p>
      <h2 className={H2}>On the website</h2>
      <p>Sign in, open Privacy, and use the Danger zone to deactivate your account, then email us to finish the deletion.</p>
      <h2 className={H2}>By email</h2>
      <p>Write to <a href="mailto:support@launchyournextchapter.com">support@launchyournextchapter.com</a> from the address on your account.</p>
      <h2 className={H2}>What happens</h2>
      <p>Your account is deactivated right away and your saved searches and app notifications stop. We then delete your account and data.</p>
    </SeoPage>
  )
}
