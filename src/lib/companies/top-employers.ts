// US employers known for pay and/or benefits — a hand-kept mirror of ncrawl's
// ~/nextchapter-jobs/data/top_employers.yaml (keep the two in step).
//
// NAMES ONLY. The rankings behind `lists` are licensed compilations (Fortune,
// Glassdoor, Forbes/Statista, Great Place to Work, JUST Capital, Indeed,
// Seramount, HRC); nothing was copied from them. Each entry records which public
// list(s) the employer is widely reported to have appeared on, around `year`.
// It is approximate: show it as "known for", name the lists, and never show a
// rank number.
//
// Pure, no I/O: the board, job cards and company pages all read it.

import { normalizeOrgName } from '@/lib/text/org-name-match'

export type TopEmployerReason = 'pay' | 'benefits' | 'culture'

export type TopEmployerList =
  | 'fortune_100_best'
  | 'gptw'
  | 'glassdoor_bptw'
  | 'forbes_best_employers'
  | 'just_capital_100'
  | 'just_capital_workers'
  | 'indeed_wellbeing'
  | 'seramount_100'
  | 'hrc_cei_100'
  | 'press_pay_benefits'

/** How each list is named to members. JUST Capital's two lists read the same. */
export const TOP_EMPLOYER_LIST_LABEL: Record<TopEmployerList, string> = {
  fortune_100_best: 'Fortune 100 Best Companies to Work For',
  gptw: 'Great Place to Work',
  glassdoor_bptw: 'Glassdoor Best Places to Work',
  forbes_best_employers: "Forbes America's Best Employers",
  just_capital_100: 'JUST Capital',
  just_capital_workers: 'JUST Capital',
  indeed_wellbeing: 'Indeed Work Wellbeing 100',
  seramount_100: 'Seramount 100 Best Companies',
  hrc_cei_100: 'HRC Corporate Equality Index',
  press_pay_benefits: 'press coverage of pay/benefits',
}

export interface TopEmployer {
  name: string
  domain: string
  reasons: TopEmployerReason[]
  lists: TopEmployerList[]
  year: number
  /** Other names our job sources use for the same employer ("Trader Joe's Company", "Alphabet"). */
  aliases?: string[]
}

export const TOP_EMPLOYERS: readonly TopEmployer[] = [
  { name: "Costco", domain: "costco.com", reasons: ["pay", "benefits"], lists: ["press_pay_benefits", "forbes_best_employers", "glassdoor_bptw", "just_capital_workers"], year: 2025, aliases: ["Costco Wholesale", "Costco Wholesale Corp /New"] },
  { name: "Trader Joe's", domain: "traderjoes.com", reasons: ["pay", "benefits"], lists: ["press_pay_benefits", "forbes_best_employers", "glassdoor_bptw"], year: 2025, aliases: ["Trader Joe's Company"] },
  { name: "Walmart", domain: "walmart.com", reasons: ["pay"], lists: ["press_pay_benefits"], year: 2025, aliases: ["Wal-Mart", "Walmart Stores"] },
  { name: "Publix", domain: "publix.com", reasons: ["benefits", "culture"], lists: ["fortune_100_best", "press_pay_benefits"], year: 2025, aliases: ["Publix Super Markets"] },
  { name: "H-E-B", domain: "heb.com", reasons: ["pay", "benefits", "culture"], lists: ["press_pay_benefits", "forbes_best_employers"], year: 2025, aliases: ["HEB", "HEB Grocery", "H-E-B Grocery"] },
  { name: "Wegmans", domain: "wegmans.com", reasons: ["benefits", "culture"], lists: ["fortune_100_best", "press_pay_benefits"], year: 2025, aliases: ["Wegmans Food Markets"] },
  { name: "In-N-Out Burger", domain: "in-n-out.com", reasons: ["pay", "benefits"], lists: ["glassdoor_bptw", "press_pay_benefits"], year: 2025, aliases: ["In-N-Out"] },
  { name: "REI", domain: "rei.com", reasons: ["benefits", "culture"], lists: ["press_pay_benefits"], year: 2024, aliases: ["REI Co-op", "Recreational Equipment"] },
  { name: "Patagonia", domain: "patagonia.com", reasons: ["benefits", "culture"], lists: ["press_pay_benefits"], year: 2024 },
  { name: "QuikTrip", domain: "quiktrip.com", reasons: ["pay", "benefits"], lists: ["fortune_100_best", "press_pay_benefits"], year: 2024 },
  { name: "Sheetz", domain: "sheetz.com", reasons: ["pay", "benefits"], lists: ["press_pay_benefits", "gptw"], year: 2024 },
  { name: "Wawa", domain: "wawa.com", reasons: ["benefits"], lists: ["press_pay_benefits"], year: 2024 },
  { name: "Kwik Trip", domain: "kwiktrip.com", reasons: ["benefits"], lists: ["press_pay_benefits"], year: 2024, aliases: ["Kwik Star"] },
  { name: "Buc-ee's", domain: "buc-ees.com", reasons: ["pay", "benefits"], lists: ["press_pay_benefits"], year: 2024, aliases: ["Bucees"] },
  { name: "Aldi US", domain: "aldi.us", reasons: ["pay"], lists: ["press_pay_benefits", "forbes_best_employers"], year: 2024, aliases: ["Aldi", "Aldi USA"] },
  { name: "Hy-Vee", domain: "hy-vee.com", reasons: ["benefits"], lists: ["forbes_best_employers"], year: 2024, aliases: ["HyVee"] },
  { name: "Target", domain: "target.com", reasons: ["pay", "benefits"], lists: ["press_pay_benefits", "just_capital_100", "hrc_cei_100"], year: 2024 },
  { name: "Starbucks", domain: "starbucks.com", reasons: ["benefits"], lists: ["press_pay_benefits", "hrc_cei_100"], year: 2024, aliases: ["Starbucks Coffee"] },
  { name: "Amazon", domain: "amazon.com", reasons: ["pay", "benefits"], lists: ["press_pay_benefits"], year: 2025, aliases: ["Amazon.com", "Amazon Web Services"] },
  { name: "Best Buy", domain: "bestbuy.com", reasons: ["benefits"], lists: ["just_capital_100", "hrc_cei_100"], year: 2024 },
  { name: "Lowe's", domain: "lowes.com", reasons: ["benefits"], lists: ["just_capital_100"], year: 2024, aliases: ["Lowe's Companies"] },
  { name: "The Home Depot", domain: "homedepot.com", reasons: ["benefits"], lists: ["press_pay_benefits"], year: 2024, aliases: ["Home Depot", "Home Depot USA"] },
  { name: "Chick-fil-A", domain: "chick-fil-a.com", reasons: ["culture", "benefits"], lists: ["glassdoor_bptw", "press_pay_benefits"], year: 2024 },
  { name: "Raising Cane's", domain: "raisingcanes.com", reasons: ["pay"], lists: ["press_pay_benefits"], year: 2024, aliases: ["Raising Cane's Chicken Fingers"] },
  { name: "Texas Roadhouse", domain: "texasroadhouse.com", reasons: ["culture"], lists: ["fortune_100_best"], year: 2024 },
  { name: "Nordstrom", domain: "nordstrom.com", reasons: ["benefits"], lists: ["hrc_cei_100"], year: 2024 },
  { name: "Ulta Beauty", domain: "ulta.com", reasons: ["benefits"], lists: ["hrc_cei_100"], year: 2024 },
  { name: "The TJX Companies", domain: "tjx.com", reasons: ["benefits"], lists: ["hrc_cei_100"], year: 2024, aliases: ["TJX"] },
  { name: "Rural King", domain: "ruralking.com", reasons: ["culture"], lists: ["gptw"], year: 2024 },
  { name: "Meijer", domain: "meijer.com", reasons: ["benefits"], lists: ["press_pay_benefits"], year: 2024 },
  { name: "Ben & Jerry's", domain: "benjerry.com", reasons: ["pay", "benefits"], lists: ["press_pay_benefits"], year: 2024, aliases: ["Ben and Jerry's"] },
  { name: "Lush Cosmetics", domain: "lushusa.com", reasons: ["benefits"], lists: ["press_pay_benefits"], year: 2024 },
  { name: "The Container Store", domain: "containerstore.com", reasons: ["pay"], lists: ["press_pay_benefits"], year: 2023 },
  { name: "Zappos", domain: "zappos.com", reasons: ["culture"], lists: ["press_pay_benefits"], year: 2023 },
  { name: "IKEA US", domain: "ikea.com", reasons: ["benefits"], lists: ["press_pay_benefits"], year: 2024, aliases: ["IKEA"] },
  { name: "Southwest Airlines", domain: "southwest.com", reasons: ["pay", "benefits", "culture"], lists: ["glassdoor_bptw", "forbes_best_employers", "press_pay_benefits"], year: 2025 },
  { name: "Delta Air Lines", domain: "delta.com", reasons: ["pay", "benefits"], lists: ["glassdoor_bptw", "forbes_best_employers", "press_pay_benefits"], year: 2025, aliases: ["Delta Airlines"] },
  { name: "Alaska Airlines", domain: "alaskaair.com", reasons: ["benefits"], lists: ["forbes_best_employers"], year: 2024 },
  { name: "United Airlines", domain: "united.com", reasons: ["pay", "benefits"], lists: ["press_pay_benefits"], year: 2024, aliases: ["United Airlines Holdings"] },
  { name: "Hilton", domain: "hilton.com", reasons: ["benefits", "culture"], lists: ["fortune_100_best", "hrc_cei_100"], year: 2025, aliases: ["Hilton Worldwide", "Hilton Worldwide Holdings", "Hilton Hotels"] },
  { name: "Hyatt", domain: "hyatt.com", reasons: ["benefits", "culture"], lists: ["fortune_100_best"], year: 2025, aliases: ["Hyatt Hotels"] },
  { name: "Marriott International", domain: "marriott.com", reasons: ["benefits", "culture"], lists: ["fortune_100_best", "hrc_cei_100"], year: 2025, aliases: ["Marriott"] },
  { name: "Four Seasons Hotels", domain: "fourseasons.com", reasons: ["benefits", "culture"], lists: ["fortune_100_best"], year: 2024, aliases: ["Four Seasons Hotel & Resorts", "Four Seasons Hotels and Resorts"] },
  { name: "Kimpton Hotels (IHG)", domain: "ihg.com", reasons: ["culture"], lists: ["fortune_100_best"], year: 2024, aliases: ["Kimpton Hotels & Restaurants", "Kimpton Hotels"] },
  { name: "Royal Caribbean Group", domain: "rclcorp.com", reasons: ["culture"], lists: ["forbes_best_employers"], year: 2024 },
  { name: "NVIDIA", domain: "nvidia.com", reasons: ["pay", "benefits"], lists: ["glassdoor_bptw", "fortune_100_best", "just_capital_100"], year: 2025 },
  { name: "Cisco", domain: "cisco.com", reasons: ["benefits", "culture"], lists: ["fortune_100_best", "just_capital_100", "hrc_cei_100"], year: 2025, aliases: ["Cisco Systems"] },
  { name: "Salesforce", domain: "salesforce.com", reasons: ["pay", "benefits"], lists: ["fortune_100_best", "just_capital_100", "hrc_cei_100"], year: 2025, aliases: ["Salesforce.com"] },
  { name: "Google", domain: "google.com", reasons: ["pay", "benefits"], lists: ["glassdoor_bptw", "just_capital_100", "indeed_wellbeing"], year: 2025, aliases: ["Alphabet", "Google LLC"] },
  { name: "Microsoft", domain: "microsoft.com", reasons: ["pay", "benefits"], lists: ["just_capital_100", "glassdoor_bptw", "forbes_best_employers"], year: 2025 },
  { name: "Apple", domain: "apple.com", reasons: ["pay", "benefits"], lists: ["just_capital_100", "indeed_wellbeing"], year: 2025 },
  { name: "Meta", domain: "meta.com", reasons: ["pay", "benefits"], lists: ["glassdoor_bptw"], year: 2024, aliases: ["Meta Platforms", "Facebook"] },
  { name: "Netflix", domain: "netflix.com", reasons: ["pay", "benefits"], lists: ["press_pay_benefits"], year: 2024 },
  { name: "Adobe", domain: "adobe.com", reasons: ["benefits", "culture"], lists: ["fortune_100_best", "just_capital_100"], year: 2025 },
  { name: "Intuit", domain: "intuit.com", reasons: ["benefits", "culture"], lists: ["fortune_100_best", "just_capital_100"], year: 2025 },
  { name: "ServiceNow", domain: "servicenow.com", reasons: ["pay", "benefits"], lists: ["fortune_100_best", "glassdoor_bptw"], year: 2025 },
  { name: "Workday", domain: "workday.com", reasons: ["benefits", "culture"], lists: ["fortune_100_best"], year: 2025 },
  { name: "Atlassian", domain: "atlassian.com", reasons: ["benefits", "culture"], lists: ["fortune_100_best"], year: 2025 },
  { name: "Cadence Design Systems", domain: "cadence.com", reasons: ["benefits", "culture"], lists: ["fortune_100_best"], year: 2025 },
  { name: "HubSpot", domain: "hubspot.com", reasons: ["benefits", "culture"], lists: ["glassdoor_bptw", "gptw"], year: 2025 },
  { name: "SAS Institute", domain: "sas.com", reasons: ["benefits"], lists: ["press_pay_benefits", "gptw"], year: 2024 },
  { name: "Dell Technologies", domain: "dell.com", reasons: ["benefits"], lists: ["just_capital_100", "hrc_cei_100"], year: 2024 },
  { name: "HP Inc.", domain: "hp.com", reasons: ["benefits"], lists: ["just_capital_100", "hrc_cei_100"], year: 2024 },
  { name: "Intel", domain: "intel.com", reasons: ["benefits"], lists: ["just_capital_100"], year: 2024, aliases: ["Intel Americas"] },
  { name: "Texas Instruments", domain: "ti.com", reasons: ["pay", "benefits"], lists: ["just_capital_100"], year: 2024 },
  { name: "Qualcomm", domain: "qualcomm.com", reasons: ["pay", "benefits"], lists: ["just_capital_100"], year: 2024, aliases: ["Qualcomm Inc/De", "Qualcomm Technologies"] },
  { name: "IBM", domain: "ibm.com", reasons: ["benefits"], lists: ["just_capital_100", "seramount_100", "hrc_cei_100"], year: 2024 },
  { name: "Synopsys", domain: "synopsys.com", reasons: ["benefits", "culture"], lists: ["fortune_100_best"], year: 2024 },
  { name: "UKG", domain: "ukg.com", reasons: ["benefits", "culture"], lists: ["fortune_100_best"], year: 2024 },
  { name: "Paylocity", domain: "paylocity.com", reasons: ["culture"], lists: ["fortune_100_best"], year: 2024 },
  { name: "Paycom", domain: "paycom.com", reasons: ["culture"], lists: ["gptw"], year: 2024 },
  { name: "Zillow", domain: "zillow.com", reasons: ["benefits"], lists: ["glassdoor_bptw"], year: 2024 },
  { name: "Airbnb", domain: "airbnb.com", reasons: ["pay", "benefits"], lists: ["glassdoor_bptw"], year: 2024 },
  { name: "Spotify", domain: "spotify.com", reasons: ["benefits"], lists: ["press_pay_benefits"], year: 2024 },
  { name: "Dropbox", domain: "dropbox.com", reasons: ["benefits"], lists: ["press_pay_benefits"], year: 2024 },
  { name: "Etsy", domain: "etsy.com", reasons: ["benefits"], lists: ["press_pay_benefits"], year: 2024 },
  { name: "Box", domain: "box.com", reasons: ["culture"], lists: ["glassdoor_bptw"], year: 2024 },
  { name: "DocuSign", domain: "docusign.com", reasons: ["benefits"], lists: ["glassdoor_bptw"], year: 2024 },
  { name: "Roblox", domain: "roblox.com", reasons: ["pay", "benefits"], lists: ["glassdoor_bptw"], year: 2024 },
  { name: "Stripe", domain: "stripe.com", reasons: ["pay", "benefits"], lists: ["press_pay_benefits"], year: 2024 },
  { name: "Databricks", domain: "databricks.com", reasons: ["pay"], lists: ["glassdoor_bptw"], year: 2025 },
  { name: "Snowflake", domain: "snowflake.com", reasons: ["pay"], lists: ["press_pay_benefits"], year: 2024, aliases: ["Snowflake Computing"] },
  { name: "Palo Alto Networks", domain: "paloaltonetworks.com", reasons: ["pay", "benefits"], lists: ["press_pay_benefits"], year: 2024 },
  { name: "Rippling", domain: "rippling.com", reasons: ["pay"], lists: ["glassdoor_bptw"], year: 2025 },
  { name: "Bloomberg", domain: "bloomberg.com", reasons: ["pay", "benefits"], lists: ["hrc_cei_100"], year: 2024 },
  { name: "Epic Systems", domain: "epic.com", reasons: ["pay", "benefits"], lists: ["press_pay_benefits"], year: 2024, aliases: ["Epic Systems Corporation"] },
  { name: "Veeva Systems", domain: "veeva.com", reasons: ["culture"], lists: ["press_pay_benefits"], year: 2024 },
  { name: "Autodesk", domain: "autodesk.com", reasons: ["benefits"], lists: ["just_capital_100", "hrc_cei_100"], year: 2024 },
  { name: "VMware (Broadcom)", domain: "broadcom.com", reasons: ["pay"], lists: ["press_pay_benefits"], year: 2024, aliases: ["VMware"] },
  { name: "Oracle", domain: "oracle.com", reasons: ["pay"], lists: ["press_pay_benefits"], year: 2024 },
  { name: "SAP America", domain: "sap.com", reasons: ["benefits"], lists: ["seramount_100", "hrc_cei_100"], year: 2024, aliases: ["SAP"] },
  { name: "Bain & Company", domain: "bain.com", reasons: ["pay", "benefits", "culture"], lists: ["glassdoor_bptw", "fortune_100_best"], year: 2025 },
  { name: "Boston Consulting Group", domain: "bcg.com", reasons: ["pay", "benefits"], lists: ["glassdoor_bptw", "fortune_100_best"], year: 2025, aliases: ["BCG"] },
  { name: "McKinsey & Company", domain: "mckinsey.com", reasons: ["pay", "benefits"], lists: ["glassdoor_bptw"], year: 2024 },
  { name: "Deloitte", domain: "deloitte.com", reasons: ["benefits"], lists: ["fortune_100_best", "seramount_100", "hrc_cei_100"], year: 2025 },
  { name: "Accenture", domain: "accenture.com", reasons: ["benefits"], lists: ["fortune_100_best", "seramount_100", "just_capital_100"], year: 2025 },
  { name: "EY", domain: "ey.com", reasons: ["benefits"], lists: ["fortune_100_best", "seramount_100", "hrc_cei_100"], year: 2025, aliases: ["Ernst & Young", "EY (Ernst & Young)"] },
  { name: "KPMG", domain: "kpmg.com", reasons: ["benefits"], lists: ["fortune_100_best", "seramount_100", "hrc_cei_100"], year: 2025 },
  { name: "PwC", domain: "pwc.com", reasons: ["benefits"], lists: ["fortune_100_best", "seramount_100", "hrc_cei_100"], year: 2025, aliases: ["PwC US", "PwC (US)", "PricewaterhouseCoopers"] },
  { name: "Ryan LLC", domain: "ryan.com", reasons: ["benefits", "culture"], lists: ["fortune_100_best"], year: 2025 },
  { name: "Kimley-Horn", domain: "kimley-horn.com", reasons: ["benefits", "culture"], lists: ["fortune_100_best"], year: 2025 },
  { name: "Burns & McDonnell", domain: "burnsmcd.com", reasons: ["benefits"], lists: ["fortune_100_best"], year: 2024 },
  { name: "Plante Moran", domain: "plantemoran.com", reasons: ["benefits", "culture"], lists: ["fortune_100_best"], year: 2024 },
  { name: "Crowe", domain: "crowe.com", reasons: ["culture"], lists: ["fortune_100_best"], year: 2024 },
  { name: "Baker Tilly", domain: "bakertilly.com", reasons: ["culture"], lists: ["gptw"], year: 2024 },
  { name: "Moss Adams", domain: "mossadams.com", reasons: ["culture"], lists: ["fortune_100_best"], year: 2024 },
  { name: "Grant Thornton", domain: "grantthornton.com", reasons: ["benefits"], lists: ["seramount_100"], year: 2024 },
  { name: "RSM US", domain: "rsmus.com", reasons: ["benefits"], lists: ["seramount_100"], year: 2024, aliases: ["RSM"] },
  { name: "Booz Allen Hamilton", domain: "boozallen.com", reasons: ["benefits"], lists: ["seramount_100", "hrc_cei_100"], year: 2024 },
  { name: "Slalom", domain: "slalom.com", reasons: ["culture"], lists: ["glassdoor_bptw"], year: 2024 },
  { name: "West Monroe", domain: "westmonroe.com", reasons: ["culture"], lists: ["gptw"], year: 2024, aliases: ["West Monroe Partners"] },
  { name: "Gensler", domain: "gensler.com", reasons: ["culture"], lists: ["gptw"], year: 2024 },
  { name: "American Express", domain: "americanexpress.com", reasons: ["benefits", "culture"], lists: ["fortune_100_best", "seramount_100"], year: 2025 },
  { name: "Capital One", domain: "capitalone.com", reasons: ["pay", "benefits"], lists: ["fortune_100_best", "seramount_100"], year: 2025, aliases: ["Capital One Financial", "Capital One National Association"] },
  { name: "Synchrony", domain: "synchrony.com", reasons: ["benefits"], lists: ["fortune_100_best"], year: 2025, aliases: ["Synchrony Financial"] },
  { name: "Edward Jones", domain: "edwardjones.com", reasons: ["benefits", "culture"], lists: ["fortune_100_best"], year: 2025 },
  { name: "Navy Federal Credit Union", domain: "navyfederal.org", reasons: ["benefits"], lists: ["fortune_100_best"], year: 2025 },
  { name: "USAA", domain: "usaa.com", reasons: ["benefits"], lists: ["fortune_100_best", "forbes_best_employers"], year: 2024 },
  { name: "Progressive", domain: "progressive.com", reasons: ["benefits"], lists: ["fortune_100_best", "seramount_100"], year: 2024, aliases: ["Progressive Insurance"] },
  { name: "Nationwide", domain: "nationwide.com", reasons: ["benefits"], lists: ["fortune_100_best"], year: 2024, aliases: ["Nationwide Insurance", "Nationwide Mutual Insurance"] },
  { name: "Mastercard", domain: "mastercard.com", reasons: ["benefits"], lists: ["just_capital_100", "seramount_100"], year: 2024 },
  { name: "Visa", domain: "visa.com", reasons: ["pay", "benefits"], lists: ["just_capital_100"], year: 2024 },
  { name: "JPMorgan Chase", domain: "jpmorganchase.com", reasons: ["pay", "benefits"], lists: ["just_capital_100", "seramount_100"], year: 2024, aliases: ["JPMorgan Chase & Co.", "JP Morgan Chase", "JPMorgan Chase Bank", "JPMorgan", "J.P. Morgan"] },
  { name: "Bank of America", domain: "bankofamerica.com", reasons: ["pay", "benefits"], lists: ["just_capital_100", "seramount_100", "just_capital_workers"], year: 2024 },
  { name: "Goldman Sachs", domain: "goldmansachs.com", reasons: ["pay", "benefits"], lists: ["hrc_cei_100"], year: 2024 },
  { name: "Morgan Stanley", domain: "morganstanley.com", reasons: ["pay"], lists: ["hrc_cei_100"], year: 2024 },
  { name: "Fidelity Investments", domain: "fidelity.com", reasons: ["benefits"], lists: ["glassdoor_bptw", "seramount_100"], year: 2024 },
  { name: "Vanguard", domain: "vanguard.com", reasons: ["benefits"], lists: ["press_pay_benefits"], year: 2024, aliases: ["The Vanguard Group"] },
  { name: "T. Rowe Price", domain: "troweprice.com", reasons: ["benefits"], lists: ["seramount_100"], year: 2024, aliases: ["T. Rowe Price Group"] },
  { name: "Northwestern Mutual", domain: "northwesternmutual.com", reasons: ["benefits"], lists: ["seramount_100"], year: 2024 },
  { name: "State Farm", domain: "statefarm.com", reasons: ["benefits"], lists: ["forbes_best_employers"], year: 2024, aliases: ["State Farm Insurance"] },
  { name: "Rocket Companies", domain: "rocketcompanies.com", reasons: ["culture"], lists: ["fortune_100_best"], year: 2024, aliases: ["Rocket Mortgage"] },
  { name: "Veterans United Home Loans", domain: "veteransunited.com", reasons: ["benefits", "culture"], lists: ["fortune_100_best"], year: 2024 },
  { name: "Pinnacle Financial Partners", domain: "pnfp.com", reasons: ["benefits", "culture"], lists: ["fortune_100_best"], year: 2025 },
  { name: "Baird", domain: "rwbaird.com", reasons: ["benefits", "culture"], lists: ["fortune_100_best"], year: 2024, aliases: ["Robert W. Baird"] },
  { name: "First American", domain: "firstam.com", reasons: ["culture"], lists: ["fortune_100_best"], year: 2024, aliases: ["First American Financial"] },
  { name: "Paychex", domain: "paychex.com", reasons: ["benefits"], lists: ["seramount_100"], year: 2024 },
  { name: "Travelers", domain: "travelers.com", reasons: ["benefits"], lists: ["hrc_cei_100"], year: 2024, aliases: ["Travelers Companies", "The Travelers Companies"] },
  { name: "Prudential Financial", domain: "prudential.com", reasons: ["benefits"], lists: ["just_capital_100", "seramount_100"], year: 2024, aliases: ["Prudential"] },
  { name: "MetLife", domain: "metlife.com", reasons: ["benefits"], lists: ["seramount_100"], year: 2024, aliases: ["Metropolitan Life Insurance"] },
  { name: "Citi", domain: "citigroup.com", reasons: ["benefits"], lists: ["seramount_100", "hrc_cei_100"], year: 2024, aliases: ["Citigroup", "Citibank"] },
  { name: "Wells Fargo", domain: "wellsfargo.com", reasons: ["pay"], lists: ["just_capital_workers"], year: 2024 },
  { name: "Ally Financial", domain: "ally.com", reasons: ["benefits"], lists: ["hrc_cei_100"], year: 2024, aliases: ["Ally"] },
  { name: "Charles Schwab", domain: "schwab.com", reasons: ["benefits"], lists: ["hrc_cei_100"], year: 2024, aliases: ["Schwab"] },
  { name: "BlackRock", domain: "blackrock.com", reasons: ["pay", "benefits"], lists: ["hrc_cei_100"], year: 2024 },
  { name: "Discover Financial", domain: "discover.com", reasons: ["benefits"], lists: ["hrc_cei_100"], year: 2024, aliases: ["Discover Financial Services"] },
  { name: "Principal Financial Group", domain: "principal.com", reasons: ["benefits"], lists: ["hrc_cei_100"], year: 2024, aliases: ["Principal Financial"] },
  { name: "Genentech", domain: "gene.com", reasons: ["pay", "benefits"], lists: ["fortune_100_best", "seramount_100"], year: 2024 },
  { name: "AbbVie", domain: "abbvie.com", reasons: ["benefits"], lists: ["fortune_100_best", "seramount_100"], year: 2025 },
  { name: "Stryker", domain: "stryker.com", reasons: ["benefits", "culture"], lists: ["fortune_100_best"], year: 2025 },
  { name: "Johnson & Johnson", domain: "jnj.com", reasons: ["benefits"], lists: ["just_capital_100", "seramount_100", "hrc_cei_100"], year: 2024 },
  { name: "Merck", domain: "merck.com", reasons: ["benefits"], lists: ["just_capital_100", "seramount_100"], year: 2024 },
  { name: "Eli Lilly", domain: "lilly.com", reasons: ["pay", "benefits"], lists: ["seramount_100", "hrc_cei_100"], year: 2024, aliases: ["Eli Lilly and Company", "Lilly"] },
  { name: "Pfizer", domain: "pfizer.com", reasons: ["benefits"], lists: ["hrc_cei_100"], year: 2024 },
  { name: "Abbott", domain: "abbott.com", reasons: ["benefits"], lists: ["seramount_100", "hrc_cei_100"], year: 2024, aliases: ["Abbott Laboratories"] },
  { name: "Bristol Myers Squibb", domain: "bms.com", reasons: ["benefits"], lists: ["seramount_100", "hrc_cei_100"], year: 2024 },
  { name: "Novartis US", domain: "novartis.com", reasons: ["benefits"], lists: ["seramount_100"], year: 2024, aliases: ["Novartis"] },
  { name: "Regeneron", domain: "regeneron.com", reasons: ["pay", "benefits"], lists: ["press_pay_benefits"], year: 2024, aliases: ["Regeneron Pharmaceuticals"] },
  { name: "Vertex Pharmaceuticals", domain: "vrtx.com", reasons: ["pay", "benefits"], lists: ["press_pay_benefits"], year: 2024 },
  { name: "Mayo Clinic", domain: "mayoclinic.org", reasons: ["benefits"], lists: ["forbes_best_employers"], year: 2025 },
  { name: "Cleveland Clinic", domain: "clevelandclinic.org", reasons: ["benefits"], lists: ["forbes_best_employers"], year: 2024 },
  { name: "Kaiser Permanente", domain: "kaiserpermanente.org", reasons: ["pay", "benefits"], lists: ["forbes_best_employers", "hrc_cei_100"], year: 2024 },
  { name: "Texas Health Resources", domain: "texashealth.org", reasons: ["benefits", "culture"], lists: ["fortune_100_best"], year: 2024 },
  { name: "Baptist Health South Florida", domain: "baptisthealth.net", reasons: ["benefits", "culture"], lists: ["fortune_100_best"], year: 2024 },
  { name: "Northwell Health", domain: "northwell.edu", reasons: ["benefits"], lists: ["fortune_100_best"], year: 2024 },
  { name: "Ochsner Health", domain: "ochsner.org", reasons: ["benefits"], lists: ["gptw"], year: 2024, aliases: ["Ochsner Clinic Foundation"] },
  { name: "Encompass Health", domain: "encompasshealth.com", reasons: ["culture"], lists: ["fortune_100_best"], year: 2024 },
  { name: "Atlantic Health System", domain: "atlantichealth.org", reasons: ["culture"], lists: ["fortune_100_best"], year: 2024 },
  { name: "Hackensack Meridian Health", domain: "hackensackmeridianhealth.org", reasons: ["culture"], lists: ["fortune_100_best"], year: 2024 },
  { name: "Stanford Health Care", domain: "stanfordhealthcare.org", reasons: ["pay", "benefits"], lists: ["forbes_best_employers"], year: 2024 },
  { name: "Intermountain Health", domain: "intermountainhealthcare.org", reasons: ["benefits"], lists: ["forbes_best_employers"], year: 2024, aliases: ["Intermountain Healthcare"] },
  { name: "UnitedHealth Group", domain: "unitedhealthgroup.com", reasons: ["benefits"], lists: ["seramount_100"], year: 2024 },
  { name: "CVS Health", domain: "cvshealth.com", reasons: ["benefits"], lists: ["hrc_cei_100"], year: 2024 },
  { name: "Medtronic", domain: "medtronic.com", reasons: ["benefits"], lists: ["hrc_cei_100"], year: 2024 },
  { name: "Boston Scientific", domain: "bostonscientific.com", reasons: ["benefits"], lists: ["hrc_cei_100"], year: 2024 },
  { name: "Novo Nordisk US", domain: "novonordisk-us.com", reasons: ["benefits"], lists: ["seramount_100"], year: 2024, aliases: ["Novo Nordisk"] },
  { name: "Biogen", domain: "biogen.com", reasons: ["benefits"], lists: ["hrc_cei_100"], year: 2024, aliases: ["Biogen Idec"] },
  { name: "Mars", domain: "mars.com", reasons: ["benefits", "culture"], lists: ["fortune_100_best"], year: 2024 },
  { name: "S.C. Johnson", domain: "scjohnson.com", reasons: ["benefits"], lists: ["press_pay_benefits"], year: 2024, aliases: ["SC Johnson & Son", "S.C. Johnson & Son"] },
  { name: "Procter & Gamble", domain: "pg.com", reasons: ["benefits"], lists: ["just_capital_100", "seramount_100", "hrc_cei_100"], year: 2024 },
  { name: "PepsiCo", domain: "pepsico.com", reasons: ["benefits"], lists: ["just_capital_100", "seramount_100"], year: 2024 },
  { name: "The Coca-Cola Company", domain: "coca-colacompany.com", reasons: ["benefits"], lists: ["hrc_cei_100"], year: 2024, aliases: ["Coca-Cola"] },
  { name: "Kellanova", domain: "kellanova.com", reasons: ["benefits"], lists: ["seramount_100"], year: 2024 },
  { name: "General Mills", domain: "generalmills.com", reasons: ["benefits"], lists: ["seramount_100", "hrc_cei_100"], year: 2024 },
  { name: "Unilever US", domain: "unileverusa.com", reasons: ["benefits"], lists: ["seramount_100"], year: 2024, aliases: ["Unilever"] },
  { name: "Colgate-Palmolive", domain: "colgatepalmolive.com", reasons: ["benefits"], lists: ["just_capital_100"], year: 2024 },
  { name: "Ecolab", domain: "ecolab.com", reasons: ["benefits"], lists: ["just_capital_100"], year: 2024, aliases: ["Ecolab USA"] },
  { name: "3M", domain: "3m.com", reasons: ["benefits"], lists: ["just_capital_100"], year: 2024 },
  { name: "Deere & Company", domain: "deere.com", reasons: ["pay", "benefits"], lists: ["forbes_best_employers"], year: 2024, aliases: ["Deere", "John Deere"] },
  { name: "Caterpillar", domain: "caterpillar.com", reasons: ["pay"], lists: ["forbes_best_employers"], year: 2024 },
  { name: "Toyota North America", domain: "toyota.com", reasons: ["benefits"], lists: ["forbes_best_employers"], year: 2024, aliases: ["Toyota Motor North America", "Toyota Motor Sales USA", "Toyota Motor Sales, U.S.A."] },
  { name: "Ford Motor Company", domain: "ford.com", reasons: ["pay", "benefits"], lists: ["press_pay_benefits", "hrc_cei_100"], year: 2024, aliases: ["Ford"] },
  { name: "General Motors", domain: "gm.com", reasons: ["pay", "benefits"], lists: ["press_pay_benefits", "hrc_cei_100"], year: 2024 },
  { name: "Lockheed Martin", domain: "lockheedmartin.com", reasons: ["benefits"], lists: ["forbes_best_employers", "hrc_cei_100"], year: 2024 },
  { name: "Northrop Grumman", domain: "northropgrumman.com", reasons: ["benefits"], lists: ["forbes_best_employers"], year: 2024 },
  { name: "Boeing", domain: "boeing.com", reasons: ["pay", "benefits"], lists: ["press_pay_benefits"], year: 2024 },
  { name: "Nucor", domain: "nucor.com", reasons: ["pay"], lists: ["press_pay_benefits"], year: 2024 },
  { name: "Lincoln Electric", domain: "lincolnelectric.com", reasons: ["pay"], lists: ["press_pay_benefits"], year: 2024, aliases: ["Lincoln Electric Holdings"] },
  { name: "W. L. Gore & Associates", domain: "gore.com", reasons: ["benefits", "culture"], lists: ["fortune_100_best"], year: 2024, aliases: ["W.L. Gore & Associates", "WL Gore & Associates"] },
  { name: "Brown-Forman", domain: "brown-forman.com", reasons: ["benefits"], lists: ["hrc_cei_100"], year: 2024 },
  { name: "Nike", domain: "nike.com", reasons: ["benefits"], lists: ["hrc_cei_100"], year: 2024 },
  { name: "Levi Strauss & Co.", domain: "levistrauss.com", reasons: ["benefits"], lists: ["hrc_cei_100"], year: 2024, aliases: ["Levi Strauss"] },
  { name: "King Arthur Baking", domain: "kingarthurbaking.com", reasons: ["benefits", "culture"], lists: ["press_pay_benefits"], year: 2024 },
  { name: "New Belgium Brewing", domain: "newbelgium.com", reasons: ["benefits"], lists: ["press_pay_benefits"], year: 2023 },
  { name: "Clif Bar", domain: "clifbar.com", reasons: ["benefits"], lists: ["press_pay_benefits"], year: 2023 },
  { name: "Johnson Controls", domain: "johnsoncontrols.com", reasons: ["benefits"], lists: ["hrc_cei_100"], year: 2024, aliases: ["Johnson Controls International"] },
  { name: "Schneider Electric US", domain: "se.com", reasons: ["benefits"], lists: ["glassdoor_bptw"], year: 2024, aliases: ["Schneider Electric"] },
  { name: "Cummins", domain: "cummins.com", reasons: ["benefits"], lists: ["hrc_cei_100"], year: 2024 },
  { name: "Verizon", domain: "verizon.com", reasons: ["benefits"], lists: ["just_capital_100", "hrc_cei_100"], year: 2024, aliases: ["Verizon Wireless", "Verizon Communications"] },
  { name: "AT&T", domain: "att.com", reasons: ["benefits"], lists: ["hrc_cei_100"], year: 2024 },
  { name: "T-Mobile", domain: "t-mobile.com", reasons: ["benefits"], lists: ["hrc_cei_100"], year: 2024, aliases: ["T-Mobile USA"] },
  { name: "Comcast", domain: "comcast.com", reasons: ["benefits"], lists: ["hrc_cei_100"], year: 2024 },
  { name: "The Walt Disney Company", domain: "disney.com", reasons: ["benefits"], lists: ["hrc_cei_100"], year: 2024, aliases: ["Disney"] },
  { name: "Southern Company", domain: "southerncompany.com", reasons: ["benefits"], lists: ["forbes_best_employers"], year: 2024, aliases: ["The Southern Company"] },
  { name: "Duke Energy", domain: "duke-energy.com", reasons: ["benefits"], lists: ["hrc_cei_100"], year: 2024 },
  { name: "Dominion Energy", domain: "dominionenergy.com", reasons: ["benefits"], lists: ["hrc_cei_100"], year: 2024 },
  { name: "Exelon", domain: "exeloncorp.com", reasons: ["benefits"], lists: ["hrc_cei_100"], year: 2024 },
  { name: "ExxonMobil", domain: "exxonmobil.com", reasons: ["pay", "benefits"], lists: ["press_pay_benefits"], year: 2024, aliases: ["Exxon Mobil", "ExxonMobil Holdings"] },
  { name: "Chevron", domain: "chevron.com", reasons: ["pay", "benefits"], lists: ["press_pay_benefits", "hrc_cei_100"], year: 2024 },
  { name: "UPS", domain: "ups.com", reasons: ["pay", "benefits"], lists: ["press_pay_benefits"], year: 2024, aliases: ["United Parcel Service"] },
  { name: "FedEx", domain: "fedex.com", reasons: ["benefits"], lists: ["hrc_cei_100"], year: 2024 },
  { name: "Camden Property Trust", domain: "camdenliving.com", reasons: ["benefits", "culture"], lists: ["fortune_100_best"], year: 2025 },
  { name: "David Weekley Homes", domain: "davidweekleyhomes.com", reasons: ["benefits", "culture"], lists: ["fortune_100_best"], year: 2024 },
  { name: "PulteGroup", domain: "pultegroupinc.com", reasons: ["benefits", "culture"], lists: ["fortune_100_best"], year: 2025, aliases: ["Pultegroup Inc/Mi/"] },
  { name: "Power Home Remodeling", domain: "powerhrg.com", reasons: ["pay", "culture"], lists: ["fortune_100_best"], year: 2024 },
  { name: "CBRE", domain: "cbre.com", reasons: ["benefits"], lists: ["hrc_cei_100"], year: 2024, aliases: ["CBRE Group"] },
  { name: "JLL", domain: "jll.com", reasons: ["benefits"], lists: ["hrc_cei_100"], year: 2024, aliases: ["Jones Lang LaSalle"] },
  { name: "Cintas", domain: "cintas.com", reasons: ["benefits"], lists: ["press_pay_benefits"], year: 2024 },
  { name: "Teach For America", domain: "teachforamerica.org", reasons: ["culture"], lists: ["fortune_100_best"], year: 2024 },
  { name: "Hallmark Cards", domain: "hallmark.com", reasons: ["benefits"], lists: ["press_pay_benefits"], year: 2023, aliases: ["Hallmark"] },
]

// normalizeOrgName drops "the", punctuation and one corporate suffix; employer
// names in job feeds also carry a trailing "LLP", "US"/"USA" or a dangling "&"
// ("JPMorgan Chase & Co." → "jpmorgan chase &"). Those are dropped too, so
// "Aldi", "Aldi US" and "ALDI USA" are one key.
const LOOSE_TAIL = /\s+(?:&|and|llp|lp|pllc|us|usa|inc|corp|co)$/

/** The key a company name is looked up by. */
export function topEmployerKey(name: string): string {
  let k = normalizeOrgName(name)
  for (let prev = ''; prev !== k; ) {
    prev = k
    k = k.replace(LOOSE_TAIL, '').trim()
  }
  return k
}

const BY_KEY: ReadonlyMap<string, TopEmployer> = (() => {
  const m = new Map<string, TopEmployer>()
  for (const e of TOP_EMPLOYERS) {
    for (const n of [e.name, ...(e.aliases ?? [])]) {
      const k = topEmployerKey(n)
      if (k && !m.has(k)) m.set(k, e)
    }
  }
  return m
})()

/** The curated entry for a company name (display name or normalized key), or null. */
export function findTopEmployer(name: string | null | undefined): TopEmployer | null {
  if (!name) return null
  return BY_KEY.get(topEmployerKey(name)) ?? null
}

export function isKnownForPay(e: TopEmployer | null): boolean {
  return !!e && e.reasons.includes('pay')
}

export function isKnownForBenefits(e: TopEmployer | null): boolean {
  return !!e && e.reasons.includes('benefits')
}

/** The list names, spelled out and de-duplicated, in the entry's order. */
export function topEmployerListNames(e: TopEmployer): string[] {
  return [...new Set(e.lists.map((l) => TOP_EMPLOYER_LIST_LABEL[l]))]
}

const REASON_LABEL: Record<TopEmployerReason, string> = { pay: 'pay', benefits: 'benefits', culture: 'workplace culture' }

/** "pay · benefits" — what the employer is known for, pay first. */
export function knownForLabel(e: TopEmployer): string {
  const order: TopEmployerReason[] = ['pay', 'benefits', 'culture']
  return order.filter((r) => e.reasons.includes(r)).map((r) => REASON_LABEL[r]).join(' · ')
}

/** One plain sentence naming the sources: "Named on Fortune 100 Best Companies to Work For and Glassdoor Best Places to Work (2025)." */
export function topEmployerSourceLine(e: TopEmployer): string {
  const names = topEmployerListNames(e)
  const press = names.includes(TOP_EMPLOYER_LIST_LABEL.press_pay_benefits)
  const lists = names.filter((n) => n !== TOP_EMPLOYER_LIST_LABEL.press_pay_benefits)
  const join = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
  if (lists.length === 0) return `Widely covered in the press for its pay and benefits (${e.year}).`
  return `Named on ${join(lists)}${press ? ', and widely covered in the press for its pay and benefits' : ''} (${e.year}).`
}
