// Curated starter list of established, well-known companies hiring for
// mid-to-senior white-collar roles, keyed to their public ATS job board
// token. Each token was verified live against the provider's public API
// before being added here (see Batch 23 for the verification process) —
// don't add a token without confirming `https://<provider host>/.../{token}`
// actually resolves, since a typo silently returns zero results forever.
//
// Greenhouse, Lever, and Ashby only expose per-company job boards — there
// is no cross-company search endpoint for any of them — so this list is
// the entire universe of companies NextChapter can search directly. Expand
// it over time; it's meant to grow, not be exhaustive on day one.

export type AtsProvider = 'greenhouse' | 'lever' | 'ashby'

export interface AtsCompany {
  name: string
  provider: AtsProvider
  token: string
}

export const ATS_COMPANIES: AtsCompany[] = [
  // Greenhouse
  { name: 'Airbnb', provider: 'greenhouse', token: 'airbnb' },
  { name: 'Stripe', provider: 'greenhouse', token: 'stripe' },
  { name: 'Robinhood', provider: 'greenhouse', token: 'robinhood' },
  { name: 'Coinbase', provider: 'greenhouse', token: 'coinbase' },
  { name: 'Pinterest', provider: 'greenhouse', token: 'pinterest' },
  { name: 'Reddit', provider: 'greenhouse', token: 'reddit' },
  { name: 'Squarespace', provider: 'greenhouse', token: 'squarespace' },
  { name: 'Affirm', provider: 'greenhouse', token: 'affirm' },
  { name: 'Peloton', provider: 'greenhouse', token: 'peloton' },
  { name: 'Lyft', provider: 'greenhouse', token: 'lyft' },
  { name: 'Duolingo', provider: 'greenhouse', token: 'duolingo' },
  { name: 'Instacart', provider: 'greenhouse', token: 'instacart' },
  { name: 'Chime', provider: 'greenhouse', token: 'chime' },
  { name: 'Brex', provider: 'greenhouse', token: 'brex' },
  { name: 'Gusto', provider: 'greenhouse', token: 'gusto' },
  { name: 'Carta', provider: 'greenhouse', token: 'carta' },
  { name: 'Asana', provider: 'greenhouse', token: 'asana' },
  { name: 'Dropbox', provider: 'greenhouse', token: 'dropbox' },
  { name: 'Cloudflare', provider: 'greenhouse', token: 'cloudflare' },
  { name: 'Datadog', provider: 'greenhouse', token: 'datadog' },
  { name: 'MongoDB', provider: 'greenhouse', token: 'mongodb' },
  { name: 'Databricks', provider: 'greenhouse', token: 'databricks' },
  { name: 'Scale AI', provider: 'greenhouse', token: 'scaleai' },
  { name: 'Figma', provider: 'greenhouse', token: 'figma' },
  { name: 'Webflow', provider: 'greenhouse', token: 'webflow' },
  { name: 'Doximity', provider: 'greenhouse', token: 'doximity' },
  { name: 'Flexport', provider: 'greenhouse', token: 'flexport' },
  { name: 'Samsara', provider: 'greenhouse', token: 'samsara' },
  { name: 'Checkr', provider: 'greenhouse', token: 'checkr' },
  { name: 'Discord', provider: 'greenhouse', token: 'discord' },
  { name: 'Roblox', provider: 'greenhouse', token: 'roblox' },
  { name: 'Nextdoor', provider: 'greenhouse', token: 'nextdoor' },

  // Lever — far fewer large companies still use Lever than Greenhouse/Ashby
  { name: 'Palantir', provider: 'lever', token: 'palantir' },
  { name: 'Outreach', provider: 'lever', token: 'outreach' },

  // Ashby — skews newer/high-growth, still real, well-known companies
  { name: 'Ramp', provider: 'ashby', token: 'ramp' },
  { name: 'Linear', provider: 'ashby', token: 'linear' },
  { name: 'Vercel', provider: 'ashby', token: 'vercel' },
  { name: 'Notion', provider: 'ashby', token: 'notion' },
  { name: 'Deel', provider: 'ashby', token: 'deel' },
  { name: 'Mercury', provider: 'ashby', token: 'mercury' },
  { name: 'OpenAI', provider: 'ashby', token: 'openai' },
  { name: 'ClickHouse', provider: 'ashby', token: 'clickhouse' },
  { name: 'Temporal', provider: 'ashby', token: 'temporal' },
  { name: 'Replit', provider: 'ashby', token: 'replit' },
  { name: 'Modal', provider: 'ashby', token: 'modal' },
  { name: 'Hex', provider: 'ashby', token: 'hex' },
  { name: 'Whoop', provider: 'ashby', token: 'whoop' },
  { name: 'Airtable', provider: 'ashby', token: 'airtable' },
  { name: 'Cursor', provider: 'ashby', token: 'cursor' },
  { name: 'Abridge', provider: 'ashby', token: 'abridge' },
  { name: 'Sierra', provider: 'ashby', token: 'sierra' },
  { name: 'Harvey', provider: 'ashby', token: 'harvey' },
  { name: 'Supabase', provider: 'ashby', token: 'supabase' },
  { name: 'ElevenLabs', provider: 'ashby', token: 'elevenlabs' },
  { name: 'Perplexity', provider: 'ashby', token: 'perplexity' },
  { name: 'Pika', provider: 'ashby', token: 'pika' },
  { name: 'Writer', provider: 'ashby', token: 'writer' },
  { name: 'PostHog', provider: 'ashby', token: 'posthog' },
]
