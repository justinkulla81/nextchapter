// Route folders the proxy needs to know (kept in step by
// src/test/app-top-level.test.ts). A portal host that serves its app at its
// root (recruiter., coach.) sends main-site paths back to the main site, but
// its own pages win when a name is shared (/dashboard, /search).
export const APP_TOP_LEVEL = new Set<string>(['about','account-deactivated','ai-skills','ai-training','api','auth','authors','benefits-network-verify','book','careers','checkin','claim','claim-reference','coach-platform','coaches','coaching','contact','credentials','dashboard','demo','dev-preview','dossier','editorial-standards','employer','employers','eqoveriq','faq','feeds','for-coaches','for-managers','for-organizations','funding','government-workforce','higher-education','how-it-works','i','in','insights','jobs','layoffs','llms-full.txt','llms.txt','membership','sitemap-index.xml','network','news','noexperience','nonprofits','onboarding','employer-home','outplacement','p','prepared','portal-help','pricing','privacy-policy','recruiters','ref','refer','reports','resources','rfp-template','scam-watch','scorecard','security','share','start','submit-resume','submit-search','support','supporter','systems','talent','terms','unemployment-benefits','updates','vs','why-stuck'])

export const PORTAL_ROOT_PAGES: Record<string, Set<string>> = {
  '/recruiters': new Set<string>(['activity','calibrate','candidates','dashboard','export','forgot-password','job-board','login','messages','pool','search','settings','signup','start','talent']),
  '/support/coach': new Set<string>(['access','activity','booking','caseload','clients','export','forgot-password','google','invite','invite-client','login','messages','settings','signup']),
}
