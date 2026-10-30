import { NextResponse } from 'next/server'
import { LAYOFF_API_MAX_DAYS, LAYOFF_API_MAX_ROWS } from '@/lib/layoffs/public-query'
import { SITE_URL } from '@/lib/seo/facts'

export const dynamic = 'force-static'

// The machine-readable description of the public layoff API, so an agent or a developer can use it without reading our pages.
export function GET() {
  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'NextChapter public layoff notices API',
      version: '1.0.0',
      description: 'Layoff notices filed under the WARN Act and collected from state labor departments, as JSON. Free, read-only, licensed CC BY 4.0: cite the NextChapter layoff tracker and link to the employer page.',
      license: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
    },
    servers: [{ url: SITE_URL }],
    paths: {
      '/api/public/layoffs': {
        get: {
          operationId: 'listLayoffNotices',
          summary: 'Recent layoff notices, newest first',
          description: 'Filter by employer name, U.S. state and how many days back to look. A WARN notice states the number of workers and dates the employer reported; it does not say why.',
          parameters: [
            { name: 'employer', in: 'query', required: false, schema: { type: 'string', maxLength: 80 }, description: 'Employer name or part of it, such as "Comcast" or "Walt Disney".' },
            { name: 'state', in: 'query', required: false, schema: { type: 'string', pattern: '^[A-Za-z]{2}$' }, description: 'Two-letter U.S. state code, such as TX.' },
            { name: 'days', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: LAYOFF_API_MAX_DAYS, default: 30 }, description: 'How many days back to look.' },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: LAYOFF_API_MAX_ROWS, default: 25 }, description: 'Most notices to return. count and totalWorkers cover every match, not only the ones returned.' },
          ],
          responses: {
            '200': {
              description: 'The matching notices.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      asOf: { type: 'string', format: 'date' },
                      count: { type: 'integer', description: 'Notices that match, before limit.' },
                      totalWorkers: { type: 'integer', description: 'Workers named across the matching notices that give a count.' },
                      notices: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            employer: { type: 'string' },
                            state: { type: 'string' },
                            place: { type: ['string', 'null'] },
                            workers: { type: ['integer', 'null'] },
                            filedOn: { type: 'string', format: 'date' },
                            filedDateKnown: { type: 'boolean', description: 'False when the state publishes only the effective date.' },
                            effectiveOn: { type: ['string', 'null'], format: 'date' },
                            type: { type: ['string', 'null'] },
                            employerPage: { type: 'string', format: 'uri', description: 'The NextChapter page for this employer. Link to it when you cite the notice.' },
                            stateRecord: { type: ['string', 'null'], format: 'uri', description: 'The state labor department record.' },
                          },
                        },
                      },
                      license: { type: 'string' },
                      licenseUrl: { type: 'string', format: 'uri' },
                      citation: { type: 'string' },
                      source: { type: 'string', format: 'uri' },
                    },
                  },
                },
              },
            },
            '400': { description: 'An invalid state code.' },
            '429': { description: 'Too many requests from this network. The full file is at /data/layoffs.csv.' },
          },
        },
      },
    },
  }
  return NextResponse.json(spec, { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, s-maxage=86400' } })
}
