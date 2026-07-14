// A copy-paste prompt for the candidate to run themselves in ChatGPT/Claude
// alongside their exported LinkedIn Connections.csv — cleans up messy
// titles/companies and flags who's worth prioritizing, before they import
// the cleaned file here. Templated, not something we generate for them.
export const NETWORK_CSV_AI_PROMPT_TEMPLATE = `I'm job searching and just exported my LinkedIn connections as a CSV. Here's the file content (or paste rows below):

[paste your Connections.csv content here]

Please:
1. Clean up messy or outdated job titles and company names.
2. Group these contacts into: (a) people who hire at or above my target level, (b) people who've made a career transition recently, (c) people at companies I'd actually want to work for, (d) everyone else.
3. Flag the 15-20 people across those groups I should reach out to first, and briefly say why each one is worth prioritizing.

My target role is [your target role], and I'm focused on [your target industry/function].`
