// Plain-language names for audit actions, so the activity page reads like a sentence.
const LABELS: Record<string, string> = {
  'export.roster': 'Downloaded the roster',
  'export.reporting': 'Downloaded the reporting summary',
  'export.clients': 'Downloaded the client list',
  'export.candidates': 'Downloaded the candidate list',
  'export.placements': 'Downloaded placements and submissions',
  'brand.updated': 'Changed the brand (logo, name or color)',
  'team.invited': 'Invited a teammate',
  'team.removed': 'Removed a teammate',
  'demo.access': 'Opened the demo as another role',
  'connection.toggled': 'Turned a connection between portals on or off',
}

export function describeAuditAction(action: string): string {
  if (LABELS[action]) return LABELS[action]
  // Unknown actions still read sensibly: "export.foo_bar" -> "Export: foo bar".
  const [group, rest] = action.split('.')
  if (!rest) return action
  return `${group.charAt(0).toUpperCase()}${group.slice(1)}: ${rest.replace(/[_-]/g, ' ')}`
}
