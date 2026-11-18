import { describe, it, expect } from 'vitest'
import { layoffCollar } from '@/lib/warn/outreach/collar'
import { htmlToText } from '@/lib/mailing/render'

const filing = (o: Partial<Parameters<typeof layoffCollar>[0]>) => layoffCollar({ employer: 'Acme', source: 'WARN_FILING', ...o })
const news = (o: Partial<Parameters<typeof layoffCollar>[0]>) => layoffCollar({ employer: 'Acme', source: 'MANUAL_ANNOUNCEMENT', ...o })

describe('which layoffs the outreach emails about', () => {
  it('trusts the notice\'s own collar tag first', () => {
    expect(filing({ workCollar: 'blue', industry: '54 Professional' })).toBe('blue')
    expect(filing({ workCollar: 'white', employer: 'Acme Distribution' })).toBe('white')
  })

  it('stops the plant, warehouse and food-service layoffs the first sends went to', () => {
    expect(filing({ employer: "Dreyer's Grand Ice Cream", industry: '31-33 Manufacturing', companyIndustry: 'Consumer Packaged Goods' })).toBe('blue')
    expect(filing({ employer: 'Americold Logistics, LLC' })).toBe('blue')
    expect(filing({ employer: 'Sodexo, Inc.', industry: '45 (NAICS 453998)' })).toBe('blue')
    expect(filing({ employer: 'MasterBrand Cabinets LLC', companyIndustry: 'Manufacturing & Industrial' })).toBe('blue')
    expect(filing({ employer: 'Children’s Place Distribution' })).toBe('blue')
    expect(filing({ employer: 'Maverick Washington LLC / Chips Casino' })).toBe('blue')
    expect(filing({ employer: 'Community Tree Service, LLC', industry: '11 Agriculture Forestry Fishing Hunting' })).toBe('blue')
    expect(filing({ employer: 'Federal Express Corporation', industry: '49 (NAICS 492110)' })).toBe('blue')
  })

  it('keeps the office layoffs', () => {
    expect(filing({ employer: 'eBay', industry: 'tech: Retail', companyIndustry: 'Retail & E-commerce' })).toBe('white')
    expect(filing({ employer: 'Battelle Memorial Institute E3', industry: '54 (NAICS 541715)' })).toBe('white')
    expect(filing({ employer: 'Elevance Health, Inc.', industry: '52 - Insurance Administration' })).toBe('white')
    expect(filing({ employer: 'Netflix, Inc.', industry: '51 Information' })).toBe('white')
  })

  it('keeps a chip or drug maker\'s filing, which the state files under manufacturing, unless the name says it is a site', () => {
    expect(filing({ employer: 'Intel Corporation', industry: '31-33 Manufacturing', companyIndustry: 'Technology & Software' })).toBe('white')
    expect(filing({ employer: 'BioMarin Pharmaceutical Inc.', industry: '31-33 Manufacturing', companyIndustry: 'Pharmaceuticals & Biotech' })).toBe('white')
    expect(filing({ employer: 'Amazon Fulfillment Center', companyIndustry: 'Technology & Software' })).toBe('blue')
  })

  it('never stops a news announcement on the company\'s industry alone: those are usually corporate cuts', () => {
    expect(news({ employer: 'Kroger', companyIndustry: 'Retail & E-commerce' })).toBe('unknown')
    expect(news({ employer: 'PepsiCo', companyIndustry: 'Consumer Packaged Goods' })).toBe('unknown')
    expect(news({ employer: 'Whole Foods', companyIndustry: 'Retail & E-commerce' })).toBe('unknown')
    expect(news({ employer: 'Borden Dairy' })).toBe('blue')
  })

  it('emails when nothing says either way', () => {
    expect(filing({ employer: 'Medline Industries, LP', companyIndustry: 'Medical Devices' })).toBe('unknown')
    expect(filing({ employer: 'Bechtel Power Corporation', companyIndustry: 'Energy & Utilities' })).toBe('unknown')
  })
})

describe('the plain-text part of an email', () => {
  it('writes a link shown as its own clean address once, with its tags', () => {
    const href = 'https://launchyournextchapter.com/network/company/acme?utm_source=layoff_outreach&amp;utm_content=A'
    const t = htmlToText(`<p>Here: <a href="${href}">https://launchyournextchapter.com/network/company/acme</a>.</p>`)
    expect(t).toBe('Here: https://launchyournextchapter.com/network/company/acme?utm_source=layoff_outreach&utm_content=A.')
  })
  it('keeps a worded link as words then the address', () => {
    expect(htmlToText('<p><a href="https://x.org/a">the report</a></p>')).toBe('the report (https://x.org/a)')
  })
})
