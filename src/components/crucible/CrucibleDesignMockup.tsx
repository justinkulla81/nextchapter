// Rendered mockups for the DESIGN variant's QA activity — the one place in
// Crucible where the defect is only catchable by looking at a rendered UI,
// not reading text. Built as real styled JSX (colors/layout/repeated
// elements actually rendered), not an image — there's no asset/upload
// pipeline anywhere else in Crucible, and a hand-authored mockup keeps the
// defect exactly reproducible and accessible-tree-inspectable rather than
// baked into a bitmap.
import type { CrucibleDesignMockupId } from '@/lib/crucible/variants'

function EasyMockup() {
  return (
    <div className="mx-auto max-w-xs rounded-2xl border border-white/10 bg-[#F5F3EE] p-5 font-[family-name:var(--font-archivo)] text-[#0D0A14]">
      <p className="text-xs font-medium text-[#0D0A14]/50">Stubs</p>
      <h2 className="mt-3 text-lg font-semibold">Confirm your invite</h2>
      <p className="mt-2 text-sm text-[#0D0A14]/70">
        You&apos;ve been invited to join the Riverside Amphitheater crew team. Confirm to get shift alerts.
      </p>
      {/* The real defect: near-white text on a near-white button — passes a
          glance, fails the moment anyone actually has to read it. */}
      <button
        type="button"
        className="mt-5 w-full rounded-full bg-[#F0EDE4] py-3 text-sm font-semibold text-[#EDEAE0]"
      >
        Confirm invite
      </button>
      <p className="mt-3 text-center text-xs text-[#0D0A14]/40">Not you? Ignore this invite.</p>
    </div>
  )
}

function MediumMockup() {
  return (
    <div className="mx-auto max-w-xs rounded-2xl border border-white/10 bg-[#F5F3EE] p-4 font-[family-name:var(--font-archivo)] text-[#0D0A14]">
      <p className="text-xs font-medium text-[#0D0A14]/50">Stubs Checkout</p>
      <h2 className="mt-2 text-base font-semibold">MIDNIGHT DROP — General Admission</h2>
      <div className="relative mt-4 rounded-lg border border-[#0D0A14]/10 bg-white p-3">
        {/* The real defect: an urgency badge absolutely positioned right on
            top of the actual price at this width — not a styling opinion,
            the number underneath is genuinely unreadable. */}
        <span className="absolute -top-2 right-3 rounded-full bg-[#FF2E9A] px-2 py-1 text-[10px] font-bold text-white shadow">
          Only 2 left!
        </span>
        <p className="text-xs text-[#0D0A14]/60">2 tickets</p>
        <p className="mt-1 text-xl font-bold">$148.00</p>
      </div>
      <button type="button" className="mt-4 w-full rounded-full bg-[#0D0A14] py-3 text-sm font-semibold text-white">
        Pay now
      </button>
    </div>
  )
}

function Avatar({ initials, tone }: { initials: string; tone: string }) {
  return (
    <div
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
      style={{ backgroundColor: tone }}
    >
      {initials}
    </div>
  )
}

function HardMockup() {
  const testimonials = [
    { name: 'Jordan M.', quote: 'Bought my tickets in two minutes flat. Zero issues.' },
    { name: 'Priya S.', quote: "Best ticketing experience I've had, and I've tried them all." },
    { name: 'Marcus T.', quote: 'Fast checkout, real seats, no surprises at the door.' },
  ]
  return (
    <div className="mx-auto max-w-sm rounded-2xl border border-white/10 bg-[#F5F3EE] p-4 font-[family-name:var(--font-archivo)] text-[#0D0A14]">
      <p className="text-xs font-medium text-[#0D0A14]/50">Trust &amp; Safety</p>
      <h2 className="mt-2 text-base font-semibold">Verified Buyers</h2>
      <div className="mt-3 space-y-3">
        {testimonials.map((t) => (
          <div key={t.name} className="flex items-start gap-3 rounded-lg border border-[#0D0A14]/10 bg-white p-3">
            {/* The real defect: identical color + identical initials on all
                three "different" reviewers — only catchable by comparing
                the rendered avatars against each other. */}
            <Avatar initials="JM" tone="#2F4B8F" />
            <div>
              <p className="text-sm font-semibold">{t.name} · Verified Buyer</p>
              <p className="mt-0.5 text-xs text-[#0D0A14]/70">&ldquo;{t.quote}&rdquo;</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CrucibleDesignMockup({ id }: { id: CrucibleDesignMockupId }) {
  if (id === 'design_easy') return <EasyMockup />
  if (id === 'design_medium') return <MediumMockup />
  return <HardMockup />
}
