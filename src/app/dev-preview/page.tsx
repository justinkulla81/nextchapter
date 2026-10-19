import Link from 'next/link'
import { MOCKUPS } from './_mockups/registry'

export default function Index() {
  const places = [...new Set(MOCKUPS.map((m) => m.place))]
  return (
    <main className="mx-auto max-w-3xl space-y-8 p-8">
      <h1 className="text-2xl font-semibold">Candidate mockups</h1>
      {places.map((pl) => (
        <section key={pl}>
          <h2 className="text-lg font-semibold">{pl}</h2>
          <ul className="list-disc pl-6">
            {MOCKUPS.filter((m) => m.place === pl).map((m) => (
              <li key={m.path}>
                <Link href={`/dev-preview/${m.path}`} className="underline">{m.title}</Link> <span className="text-sm text-muted-foreground">replaces {m.replaces}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
