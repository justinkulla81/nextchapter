// Events the job X-ray extension may report (allowlist: nothing else is written to analytics).
export const XRAY_EVENTS = new Set(['xray_panel_shown', 'xray_link_clicked'])
export const XRAY_SITES = new Set(['linkedin', 'indeed', 'google'])
export const XRAY_LINKS = new Set(['ai_check', 'layoffs', 'career_site', 'nc_job'])

/** Anonymous install ids are random uuids made by the extension; anything else is not stored. */
export const isInstallId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)
