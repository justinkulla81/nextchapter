'use client'

// The last resort: the root layout itself failed, so there is no stylesheet or theme. Plain inline styles only.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'Inter, system-ui, sans-serif', color: '#0f1b2b', background: '#ffffff' }}>
        <main style={{ maxWidth: 560, margin: '0 auto', padding: '96px 24px' }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>This page didn’t load</h1>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: '#55606e' }}>That was on our side, not yours. Reload to try again.</p>
          {error.digest ? <p style={{ fontSize: 14, color: '#55606e' }}>Error reference: {error.digest}</p> : null}
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ marginTop: 16, height: 48, padding: '0 24px', borderRadius: 999, border: 0, background: '#0f1b2b', color: '#ffffff', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}
          >
            Reload this page
          </button>
          <p style={{ marginTop: 24, fontSize: 14 }}>
            Still stuck? <a href="https://launchyournextchapter.com/contact" style={{ color: '#0f1b2b' }}>Write to us</a> and include the error reference.
          </p>
        </main>
      </body>
    </html>
  )
}
