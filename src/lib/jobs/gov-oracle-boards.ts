// Government employers whose own Oracle Recruiting Cloud career site lists their jobs. Each was checked live (jobs listed).
// Add a board with the host and siteNumber from its URL: https://<host>/hcmUI/CandidateExperience/en/sites/<site>/jobs.
import type { OracleBoard } from '@/lib/jobs/gov-oracle-core'

export const GOV_ORACLE_BOARDS: OracleBoard[] = [
  { host: 'fa-etvc-saasfaprod1.fa.ocs.oraclecloud.com', site: 'CX_1001', employer: 'Dallas County', place: 'Dallas, TX' },
  { host: 'iayzqy.fa.ocs.oraclecloud.com', site: 'CX_1', employer: 'Shelby County Government', place: 'Memphis, TN' },
  { host: 'fa-etyr-saasfaprod1.fa.ocs.oraclecloud.com', site: 'CX_2', employer: 'City of Oklahoma City', place: 'Oklahoma City, OK' },
  { host: 'eolj.fa.us2.oraclecloud.com', site: 'CX_3001', employer: 'Berks County', place: 'Reading, PA' },
  { host: 'eieb.fa.us6.oraclecloud.com', site: 'CX_1001', employer: 'Lucas County', place: 'Toledo, OH' },
]
