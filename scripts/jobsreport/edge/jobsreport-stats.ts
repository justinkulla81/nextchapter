// Read-only aggregate statistics for one geo (no posting rows leave the database).
// Deployed as Supabase edge function "jobsreport-stats" with verify_jwt=false; the token below gates it.
// Replace the placeholder with a random token at deploy time; never commit the real value. Callers send it in x-stats-token.
import postgres from 'npm:postgres@3'
const TOKEN = Deno.env.get('STATS_TOKEN') ?? '__SET_BEFORE_DEPLOY__'
const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { max: 1 })

const WC = (g: string) => sql`geo = ${g} and white_collar and (county_fips is not null)`

async function stats(g: string) {
  const [overview] = await sql`
    select count(*)::int postings, count(*) filter (where white_collar)::int white_collar,
      count(*) filter (where white_collar is null)::int unclassified,
      count(distinct employer)::int employers,
      count(*) filter (where county_fips is not null)::int in_county,
      count(*) filter (where white_collar and county_fips is not null)::int wc_in_county
    from jobsreport_posting where geo = ${g}`
  const levels = await sql`
    select level, count(*)::int n from jobsreport_posting where ${WC(g)} group by 1 order by 2 desc`
  const functions = await sql`
    select function, count(*)::int n, count(*) filter (where level='ENTRY')::int entry, count(distinct employer)::int employers,
      (percentile_cont(0.5) within group (order by (pay_min+coalesce(pay_max,pay_min))/2)
        filter (where pay_period='year' and pay_min between 20000 and 1000000))::int median_pay
    from jobsreport_posting where ${WC(g)} group by 1 order by 2 desc`
  const employers = await sql`
    select employer, source_type, count(*)::int n, count(*) filter (where white_collar)::int wc,
      count(*) filter (where white_collar and level='ENTRY')::int wc_entry
    from jobsreport_posting where geo = ${g} group by 1,2 order by 3 desc limit 25`
  const [signals] = await sql`
    with b as (select *, lower(coalesce(description,'')) d from jobsreport_posting where ${WC(g)})
    select count(*)::int n,
     round(100.0*count(*) filter (where d ~ '\\m(artificial intelligence|machine learning|generative ai|genai|llm|large language model|copilot|chatgpt|ai[- ]powered|ai tools?)\\M' or d ~ '(^|[^a-z])ai([^a-z]|$)')/nullif(count(*),0),1) ai_pct,
     round(100.0*count(*) filter (where d ~ '\\mremote\\M' or arrangement='remote')/nullif(count(*),0),1) remote_mention_pct,
     round(100.0*count(*) filter (where d ~ '\\mhybrid\\M' or arrangement='hybrid')/nullif(count(*),0),1) hybrid_mention_pct,
     round(100.0*count(*) filter (where employment_type ilike '%part%')/nullif(count(*),0),1) part_time_pct,
     round(100.0*count(*) filter (where d ~ '\\m(contract|contractor|1099|temporary|temp-to-hire|fractional|interim|freelance)\\M')/nullif(count(*),0),1) contract_words_pct,
     round(100.0*count(*) filter (where pay_min is not null)/nullif(count(*),0),1) pay_stated_pct,
     (percentile_cont(0.5) within group (order by (pay_min+coalesce(pay_max,pay_min))/2)
        filter (where pay_period='year' and pay_min between 20000 and 1000000))::int median_annual_pay,
     (percentile_cont(0.5) within group (order by (pay_min+coalesce(pay_max,pay_min))/2)
        filter (where pay_period='hour' and pay_min between 8 and 300))::numeric(8,2) median_hourly_pay,
     count(*) filter (where posted_at is not null)::int dated,
     round(100.0*count(*) filter (where posted_at < now()-interval '90 days')/nullif(count(*) filter (where posted_at is not null),0),1) older_than_90d_pct
    from b`
  const aiVs = await sql`
    with b as (select *, lower(coalesce(description,'')) d from jobsreport_posting where ${WC(g)}),
    t as (select *, (d ~ '\\m(artificial intelligence|machine learning|generative ai|genai|llm|large language model|copilot|chatgpt|ai[- ]powered|ai tools?)\\M' or d ~ '(^|[^a-z])ai([^a-z]|$)') ai from b)
    select ai, count(*)::int n,
      (percentile_cont(0.5) within group (order by (pay_min+coalesce(pay_max,pay_min))/2)
        filter (where pay_period='year' and pay_min between 20000 and 1000000))::int median_pay,
      round(100.0*count(*) filter (where level in ('SENIOR_IC','MANAGER','DIRECTOR','VP_PLUS'))/count(*),1) senior_plus_pct,
      round(100.0*count(*) filter (where d ~ '\\m(remote|hybrid)\\M')/count(*),1) remote_or_hybrid_pct
    from t group by ai order by ai desc`
  const eq = await sql`
    with b as (select lower(coalesce(description,'')) d from jobsreport_posting where ${WC(g)})
    select skill, count(*)::int n from (
      select unnest(array_remove(array[
        case when d ~ 'communicat' then 'communication' end,
        case when d ~ '\\m(collaborat\\w*|teamwork|team player|cross-functional)\\M' then 'collaboration' end,
        case when d ~ '\\mleadership\\M' then 'leadership' end,
        case when d ~ '\\m(problem[- ]solving|critical thinking)\\M' then 'problem solving' end,
        case when d ~ '\\m(adaptab\\w+|flexib\\w+)\\M' then 'adaptability' end,
        case when d ~ '\\m(empath\\w+|emotional intelligence|compassion\\w*)\\M' then 'empathy' end,
        case when d ~ '\\mcreativ\\w+' then 'creativity' end,
        case when d ~ '\\m(sql|python|excel|tableau|power bi|sap|salesforce|epic)\\M' then 'named tools' end
      ], null)) skill from b) s group by 1 order by 2 desc`
  const firstSeen = await sql`
    select min(first_seen)::date first_crawl, max(last_seen)::date last_crawl,
      count(distinct last_run_id)::int runs from jobsreport_posting where geo = ${g}`
  return { geo: g, overview, levels, functions, employers, signals, aiVs, eq, crawl: firstSeen[0] }
}

Deno.serve(async (req) => {
  if (req.headers.get('x-stats-token') !== TOKEN) return new Response('no', { status: 401 })
  const { geo, peers = [] } = await req.json()
  if (!/^[a-z0-9-]{2,40}$/.test(geo)) return new Response('bad geo', { status: 400 })
  const out = [await stats(geo)]
  for (const p of peers) if (/^[a-z0-9-]{2,40}$/.test(p)) out.push(await stats(p))
  return Response.json(out)
})
