import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { keywordMapMarkdown } from '../../src/lib/seo/keyword-map-md'

writeFileSync(join(process.cwd(), 'docs/seo/keyword-map.md'), `${keywordMapMarkdown()}\n`)
console.log('wrote docs/seo/keyword-map.md')
