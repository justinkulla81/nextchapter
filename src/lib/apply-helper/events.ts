// Events the extension may report (allowlist: nothing else is written to analytics).
export const APPLY_HELPER_EVENTS = new Set([
  'apply_helper_connected',
  'apply_helper_disconnected',
  'apply_helper_turned_on',
  'apply_helper_turned_off',
  'apply_helper_page_seen',
  'apply_helper_filled',
])

export const APPLY_HELPER_SITES = new Set(['greenhouse', 'ashby', 'lever', 'popup'])
