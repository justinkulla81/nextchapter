import { PullTop } from '@/components/capture/PullCta'

// The /layoffs next-step box on its own, for a screenshot.
export default function Preview() {
  return (
    <main className="mx-auto max-w-6xl bg-off-white px-6 py-8">
      <PullTop name="Layoff tracker" path="/layoffs" />
    </main>
  )
}
