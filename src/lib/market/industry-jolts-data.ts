// Which BLS JOLTS industry stands closest to each of our industry buckets. A bucket with no sensible sector (Other,
// Non-profit, Agriculture, which JOLTS leaves out) is absent: the page shows nothing rather than a stand-in.

export interface JoltsReading { value: number; yearAgo: number; asOf: string }
export interface JoltsMeasures { openings?: JoltsReading; hires?: JoltsReading; layoffs?: JoltsReading }

export const JOLTS_CODE_BY_BUCKET: Record<string, { code: string; label: string }> = {
  'Financial Services & Banking': { code: '520000', label: 'finance and insurance' },
  Insurance: { code: '520000', label: 'finance and insurance' },
  'Accounting & Audit': { code: '540099', label: 'professional and business services' },
  'Legal Services': { code: '540099', label: 'professional and business services' },
  'Professional Services & Consulting': { code: '540099', label: 'professional and business services' },
  'Advertising, Marketing & PR': { code: '540099', label: 'professional and business services' },
  'Staffing & Human Capital': { code: '540099', label: 'professional and business services' },
  'Technology & Software': { code: '510000', label: 'information' },
  Telecommunications: { code: '510000', label: 'information' },
  'Media & Entertainment': { code: '510000', label: 'information' },
  'Healthcare & Hospital Systems': { code: '620000', label: 'health care and social assistance' },
  'Pharmaceuticals & Biotech': { code: '620000', label: 'health care and social assistance' },
  'Education & EdTech': { code: '610000', label: 'educational services' },
  'Retail & E-commerce': { code: '440000', label: 'retail trade' },
  'Consumer Packaged Goods': { code: '300000', label: 'manufacturing' },
  'Manufacturing & Industrial': { code: '300000', label: 'manufacturing' },
  'Automotive & Mobility': { code: '300000', label: 'manufacturing' },
  'Aerospace & Defense': { code: '300000', label: 'manufacturing' },
  'Medical Devices': { code: '300000', label: 'manufacturing' },
  'Hospitality, Travel & Food Service': { code: '720000', label: 'accommodation and food services' },
  'Energy & Utilities': { code: '480099', label: 'transportation, warehousing and utilities' },
  'Construction & Real Estate': { code: '230000', label: 'construction' },
  'Transportation & Logistics': { code: '480099', label: 'transportation, warehousing and utilities' },
  'Government & Public Sector': { code: '900000', label: 'government' },
}
