import { Action, Panel, Pill, PortalFrame, Quiet, Table, Title } from './portal-frame'

// Sample-data previews of the coach portal, for /coaches. Maya Ortiz and every client are made up. They follow the
// built pages: src/app/support/coach/(app)/clients (the client list), clients/[token]/[clientId] (the Pre-Session
// Brief) and clients/[token]/[clientId]/full (the full client view with the session log). Nothing about scheduling or
// billing is shown, because neither is live. Rendered by scripts/marketing/render-screenshots.mjs.

const NAV = ['Home', 'Clients', 'Messages', 'Invite a client', 'Codes and sessions', 'Share invite link', 'Downloads and activity', 'Settings']
const BRAND = { name: 'Maya Ortiz Coaching', logoUrl: null, accent: '#8ab17d' }

export function CoachClients() {
  return (
    <PortalFrame type="coach" brand={BRAND} nav={NAV} active="Clients" trail="Clients">
      <Title intro="Everyone who joined with your code, with what they chose to share." action={<Action>Invite a client</Action>}>
        Clients
      </Title>
      <Panel title="Your clients" why="grade, trend and week in search sit side by side, so you can see who is slipping before the session.">
        <Table
          head={['Client', 'Week in search', 'Execution grade', 'Trend']}
          rows={[
            ['Dana W.', 'Week 9', 'C (Average)', <Pill key="a" tone="warm">Slipping</Pill>],
            ['Chris A.', 'Week 14', 'C (Average)', <Pill key="b">Steady</Pill>],
            ['Priya N.', 'Week 4', 'B (Good)', <Pill key="c" tone="good">Improving</Pill>],
            ['Luis M.', 'Week 11', 'B (Good)', <Pill key="d">Steady</Pill>],
            ['Hannah B.', 'Week 2', 'No grade yet', <Pill key="e">New</Pill>],
          ]}
        />
      </Panel>
    </PortalFrame>
  )
}

export function CoachBrief() {
  return (
    <PortalFrame type="coach" brand={BRAND} nav={NAV} active="Clients" trail="Clients › Dana W. › Pre-session brief">
      <Title intro="Week 9 in search. Built from what Dana shares with you, before you say hello." action={<Action>Open full client view</Action>}>
        Pre-session brief: Dana W.
      </Title>
      <div className="grid grid-cols-[1.3fr_1fr] gap-6">
        <div className="space-y-6">
          <Panel title="Tracked dimensions" why="seven things a search needs, each read from her recent activity and your last notes.">
            <ul className="divide-y divide-border text-sm">
              {[
                ['Targeting', 'On track', ''],
                ['Motivation', 'Dipped this week', 'down'],
                ['Networking', 'Strong', 'up'],
                ['Application volume', 'On track', ''],
                ['Skills', 'Named gap: negotiation', ''],
                ['Narrative', 'Improving', 'up'],
                ['Interview practice', '2 sessions logged', ''],
              ].map(([d, s, t]) => (
                <li key={d} className="flex items-center justify-between py-2.5">
                  <span className="font-medium text-ink">{d}</span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Pill tone={s === 'Dipped this week' ? 'warm' : 'muted'}>{s}</Pill>
                    {t && <span aria-label={t === 'up' ? 'Trending up' : 'Trending down'}>{t === 'up' ? '↑' : '↓'}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="This week’s actions" why="what Dana committed to, so you start with what she did and did not do.">
            <ul className="space-y-1.5 text-sm">
              <li className="text-ink">✓ Message three former colleagues in healthcare finance</li>
              <li className="text-muted-foreground">○ Rewrite the top bullet of her résumé</li>
            </ul>
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel title="Market reality assessment">
            <p className="text-lg font-semibold text-ink">C <span className="font-normal text-muted-foreground">(Average)</span> <span className="ml-2 text-sm font-normal text-muted-foreground">Slipping</span></p>
          </Panel>
          <Panel title="Suggested opening question" why="motivation dipped after two interviews without an offer.">
            <p className="text-sm text-ink">“Two interviews without an offer is a lot to carry. What would help most this week?”</p>
          </Panel>
          <Panel title="Last mood check-in">
            <p className="text-sm text-ink">Getting there <span className="text-muted-foreground">(October 22). Moods have dropped two weeks running.</span></p>
          </Panel>
        </div>
      </div>
    </PortalFrame>
  )
}

export function CoachSessionLog() {
  return (
    <PortalFrame type="coach" brand={BRAND} nav={NAV} active="Clients" trail="Clients › Dana W. › Full client view">
      <Title intro="Week 9 in search. Log what you discussed. Directives you write show up for Dana; your private notes never do.">
        Full client view: Dana W.
      </Title>
      <div className="grid grid-cols-2 gap-6">
        <Panel title="Log a session" why="a note and a directive take one minute, and the directive lands in Dana’s plan.">
          <div className="space-y-3 text-sm">
            {[['Date', 'October 24'], ['Minutes', '45'], ['Private notes', 'Anxious about the pace of outreach. Worked through a script together.'], ['Directives for Dana', 'Send 5 outreach messages this week using the script we built.']].map(([l, v]) => (
              <div key={l}>
                <p className="text-xs font-medium text-muted-foreground">{l}</p>
                <p className="mt-1 rounded-md border border-input px-3 py-2 text-ink">{v}</p>
              </div>
            ))}
            <Action>Save session</Action>
          </div>
        </Panel>
        <div className="space-y-6">
          <Panel title="Session log">
            <ul className="space-y-4 text-sm">
              {[
                ['October 24 · 45 min', 'Anxious about the pace of outreach. Worked through a script together.', 'Send 5 outreach messages this week using the script we built.'],
                ['October 15 · 30 min', 'Gaining confidence in interviews but hesitant to reach second-degree connections.', 'Send 3 warm messages to second-degree connections at target companies.'],
              ].map(([d, n, a]) => (
                <li key={d} className="space-y-1 border-b border-border pb-3 last:border-0">
                  <p className="font-semibold text-ink">{d}</p>
                  <p className="text-muted-foreground">Notes: {n}</p>
                  <p className="text-muted-foreground">Directives: {a}</p>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Targeting" why="what Dana says she is looking for, so your advice fits her search.">
            <p className="text-sm text-ink">Laid off · Finance operations director · Healthcare and food production</p>
            <Quiet>Open documents</Quiet>
          </Panel>
        </div>
      </div>
    </PortalFrame>
  )
}
