import { confirmBenefitsNetworkVerification } from '@/lib/benefits-network/verification'

function StatusMessage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-muted-foreground">{children}</p>
    </div>
  )
}

// Public, no-login-required landing page — the person clicking this link is
// institution staff confirming an alum's offer, not a NextChapter account
// holder. §A4.2 step 2: this click IS the verification event. See
// confirmBenefitsNetworkVerification (src/lib/benefits-network/
// verification.ts) for what it actually does (sets institutionDomain, flips
// the listing LISTED).
export default async function BenefitsNetworkVerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const result = await confirmBenefitsNetworkVerification(token)

  if ('error' in result) {
    return <StatusMessage title="This link isn't valid">{result.error}</StatusMessage>
  }

  return (
    <StatusMessage title="Offer confirmed">
      Thank you for confirming {result.institutionName}&apos;s offer. It&apos;s now listed on NextChapter&apos;s
      Alumni Benefits Network for our members.
    </StatusMessage>
  )
}
