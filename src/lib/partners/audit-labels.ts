// Plain-language names for audit actions, so the activity page reads like a sentence.
const LABELS: Record<string, string> = {
  'export.roster': 'Downloaded the roster',
  'export.reporting': 'Downloaded the reporting summary',
  'export.clients': 'Downloaded the client list',
  'export.candidates': 'Downloaded the candidate list',
  'export.review': 'Opened the quarterly review',
  'export.placements': 'Downloaded placements and submissions',
  'export.updates': 'Downloaded the CRM updates file',
  'export.suppression': 'Downloaded the do-not-solicit list',
  'export.etpl': 'Downloaded the training program results',
  'export.wioa': 'Downloaded the WIOA participants',
  'export.member_data': 'Downloaded one member’s data',
  'team.invite_resent': 'Sent a teammate’s invite again',
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
