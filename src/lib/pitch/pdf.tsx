/* eslint-disable jsx-a11y/alt-text -- react-pdf's Image has no alt attribute */
import React from 'react'
import { Document, Page, Text, View, Image, StyleSheet, Font, renderToBuffer } from '@react-pdf/renderer'

Font.registerHyphenationCallback((word) => [word])
import type { Deck, DeckSlide } from './types'

// Same Deck, drawn for print. 16:9 pages at 960x540 points so the PDF matches
// the slides one for one.
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
const INK = '#1F2937', MUTED = '#6B7280', NAVY = '#0B2545'

export async function renderPdf(deck: Deck, opts: { headshot?: string } = {}): Promise<Buffer> {
  const P = deck.brand.primary, A = deck.brand.accent
  const s = StyleSheet.create({
    page: { padding: 44, fontFamily: 'Helvetica', color: INK },
    kicker: { fontSize: 9, color: P, letterSpacing: 1.5, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
    title: { fontSize: 24, fontFamily: 'Helvetica-Bold', marginBottom: 20 },
    bullet: { flexDirection: 'row', marginBottom: 14 },
    dot: { width: 16, color: P, fontSize: 20 },
    btext: { flex: 1, fontSize: 20, lineHeight: 1.3 },
    footer: { position: 'absolute', left: 44, right: 44, bottom: 20, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: '#E5E7EB', paddingTop: 6 },
    fl: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: NAVY }, fr: { fontSize: 8, color: MUTED },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
    card: { backgroundColor: '#F3F4F6', borderRadius: 6, padding: 14, borderWidth: 0.5, borderColor: '#E5E7EB' },
    big: { fontSize: 34, fontFamily: 'Helvetica-Bold', color: P },
    lab: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginTop: 4 }, note: { fontSize: 8, color: MUTED, marginTop: 3 },
    th: { backgroundColor: P, color: '#FFFFFF', fontSize: 10, fontFamily: 'Helvetica-Bold', padding: 5 },
    td: { fontSize: 10, padding: 5, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  })

  const Footer = ({ n }: { n: number }) => (
    <View style={s.footer} fixed={false}><Text style={s.fl}>NextChapter</Text><Text style={s.fr}>{n}</Text></View>
  )
  const Head = ({ d }: { d: DeckSlide }) => (<>{d.kicker ? <Text style={s.kicker}>{d.kicker.toUpperCase()}</Text> : null}<Text style={s.title}>{d.title}</Text></>)
  const Table = ({ d }: { d: DeckSlide }) => {
    const cols = d.head?.length ?? 1
    return (
      <View>
        <View style={{ flexDirection: 'row' }}>{(d.head ?? []).map((h, k) => <Text key={k} style={[s.th, { width: `${100 / cols}%` }]}>{h}</Text>)}</View>
        {(d.rows ?? []).map((r, i) => <View key={i} style={{ flexDirection: 'row' }}>{r.map((c, k) => <Text key={k} style={[s.td, { width: `${100 / cols}%` }]}>{c}</Text>)}</View>)}
        {d.bullets.length ? <Text style={[s.note, { marginTop: 10 }]}>{d.bullets.join(' ')}</Text> : null}
      </View>
    )
  }

  const doc = (
    <Document title={deck.title} author="NextChapter">
      {deck.slides.map((d, idx) => {
        const n = idx + 1
        if (d.kind === 'cover') {
          return (
            <Page key={d.id} size={[960, 540]} style={[s.page, { backgroundColor: P, color: '#FFFFFF', padding: 70 }]}>
              <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 26, backgroundColor: A }} />
              <Text style={{ fontSize: 12, letterSpacing: 3, fontFamily: 'Helvetica-Bold', marginTop: 60 }}>{(d.kicker ?? '').toUpperCase()}</Text>
              <Text style={{ fontSize: 40, fontFamily: 'Helvetica-Bold', marginTop: 14, maxWidth: 760 }}>{d.title}</Text>
              <View style={{ position: 'absolute', left: 70, right: 70, bottom: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 22, fontFamily: 'Helvetica-Bold' }}>NextChapter</Text>
                {deck.brand.logo ? <View style={{ backgroundColor: '#FFFFFF', padding: 10, borderRadius: 6 }}><Image src={deck.brand.logo} style={{ height: 70, maxWidth: 220, objectFit: 'contain' }} /></View> : <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold' }}>{deck.brand.orgName}</Text>}
              </View>
            </Page>
          )
        }
        if (d.kind === 'divider') {
          return (<Page key={d.id} size={[960, 540]} style={[s.page, { backgroundColor: NAVY, color: '#FFFFFF', justifyContent: 'center', padding: 70 }]}><Text style={{ fontSize: 34, fontFamily: 'Helvetica-Bold' }}>{d.title}</Text><Text style={{ fontSize: 14, color: '#D1D5DB', marginTop: 10 }}>The detail behind the numbers in this deck</Text></Page>)
        }
        return (
          <Page key={d.id} size={[960, 540]} style={s.page}>
            <Head d={d} />
            {d.kind === 'stats' && (
              <View style={s.grid}>{(d.facts ?? []).map((x, k) => (
                <View key={k} style={[s.card, { width: (d.facts?.length ?? 0) > 4 ? 205 : 'auto', flexGrow: 1, flexBasis: 190 }]}>
                  <Text style={s.big}>{x.value}</Text><Text style={s.lab}>{x.label}</Text>{x.note ? <Text style={s.note}>{x.note}</Text> : null}
                </View>))}</View>
            )}
            {d.kind === 'stats' && d.bullets.length > 0 && (
              <View style={{ marginTop: 22 }}>{d.bullets.map((b, k) => (<View key={k} style={s.bullet}><Text style={s.dot}>•</Text><Text style={[s.btext, { fontSize: 17 }]}>{b}</Text></View>))}</View>
            )}
            {['warn', 'employers', 'colleges', 'datacenters', 'board', 'constituents'].includes(d.kind) && <Table d={d} />}
            {d.kind === 'offer' && d.offer && (
              <View style={{ flexDirection: 'row', gap: 14 }}>
                {[['Every package includes', d.offer.scope], ['What we need from you', d.offer.theyProvide], ['How we start', [d.offer.name, `Length: ${d.offer.term || 'to be agreed'}`, 'Scope agreed with you on a first call', ...(d.offer.price.trim() ? [`Price: ${d.offer.price.trim()}`] : [])].filter(Boolean)]].map(([t, items], k) => (
                  <View key={k} style={[s.card, { flex: 1 }]}><Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: P, marginBottom: 8 }}>{t as string}</Text>
                    {(items as string[]).map((x, j) => <Text key={j} style={{ fontSize: 12, marginBottom: 6 }}>• {x}</Text>)}</View>))}
              </View>
            )}
            {d.kind === 'packages' && (
              <View style={{ flexDirection: 'row', gap: 14 }}>{(d.packages ?? []).map((x, k) => (
                <View key={k} style={[s.card, { flex: 1, backgroundColor: k === 1 ? '#F3F4F6' : '#FFFFFF', borderColor: k === 1 ? P : '#E5E7EB', borderWidth: k === 1 ? 1.5 : 0.5 }]}>
                  <Text style={{ fontSize: 17, fontFamily: 'Helvetica-Bold', color: P }}>{x.name}</Text>
                  <Text style={{ fontSize: 10, color: MUTED, marginTop: 4, marginBottom: 8 }}>{x.bestFor}</Text>
                  {x.includes.map((t, j) => <Text key={j} style={{ fontSize: 11, marginBottom: 5 }}>• {t}</Text>)}
                </View>))}</View>
            )}
            {d.kind === 'demo' && d.demo && (
              <View>
                <View style={{ borderWidth: 1, borderColor: '#9CA3AF', borderRadius: 8 }}>
                  <View style={{ backgroundColor: '#F3F4F6', padding: 6, flexDirection: 'row', gap: 6, alignItems: 'center', borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
                    {['#EF4444', '#F59E0B', '#10B981'].map((c) => <View key={c} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />)}
                    <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: NAVY, marginLeft: 6 }}>{d.demo.frame}</Text>
                  </View>
                  <View style={{ padding: 12 }}>
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>{d.demo.kpis.map((x, k) => (
                      <View key={k} style={[s.card, { flex: 1, padding: 9 }]}><Text style={{ fontSize: 24, fontFamily: 'Helvetica-Bold', color: P }}>{x.value}</Text><Text style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{x.label}</Text></View>))}</View>
                    <View style={{ flexDirection: 'row', backgroundColor: '#E5E7EB' }}>{d.demo.head.map((h, k) => <Text key={k} style={{ width: `${100 / d.demo!.head.length}%`, fontSize: 10.5, fontFamily: 'Helvetica-Bold', padding: 6 }}>{h}</Text>)}</View>
                    {d.demo.rows.map((r, i) => <View key={i} style={{ flexDirection: 'row' }}>{r.map((c, k) => <Text key={k} style={{ width: `${100 / d.demo!.head.length}%`, fontSize: 11, padding: 6, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' }}>{c}</Text>)}</View>)}
                  </View>
                </View>
                <Text style={{ fontSize: 8, color: MUTED, marginTop: 5, textAlign: 'right' }}>Illustrative sample data. Not real people, employers or results.</Text>
              </View>
            )}
            {d.kind === 'timeline' && (
              <View style={{ flexDirection: 'row', gap: 14 }}>{d.bullets.slice(0, 3).map((b, k) => { const [lead, ...rest] = b.split(': '); return (
                <View key={k} style={[s.card, { flex: 1 }]}><Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: P, marginBottom: 8 }}>{rest.length ? lead : `Step ${k + 1}`}</Text><Text style={{ fontSize: 13 }}>{cap(rest.length ? rest.join(': ') : b)}</Text></View>) })}</View>
            )}
            {d.kind === 'people' && (
              <View style={s.grid}>{(d.people ?? []).slice(0, 6).map((x, k) => (
                <View key={k} style={[s.card, { width: 270 }]}>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {x.name.startsWith('Justin') && opts.headshot ? <Image src={opts.headshot} style={{ width: 46, height: 46, borderRadius: 23 }} /> : null}
                    <View style={{ flex: 1 }}><Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold' }}>{x.name}</Text><Text style={s.note}>{x.title}, {x.org}</Text></View>
                  </View>
                  {x.bio ? <Text style={{ fontSize: 9.5, marginTop: 8 }}>{x.bio}</Text> : null}
                </View>))}</View>
            )}
            {d.kind === 'bullets' && d.constituent && d.bullets.length >= 3 && (
              <View style={{ flexDirection: 'row', gap: 14 }}>{d.bullets.slice(0, 3).map((b, k) => (
                <View key={k} style={[s.card, { flex: 1, minHeight: 250, padding: 20, backgroundColor: k === 1 ? '#F3F4F6' : '#FFFFFF', borderColor: k === 1 ? P : '#E5E7EB', borderWidth: k === 1 ? 1.5 : 0.5 }]}>
                  <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: P, letterSpacing: 1.5, marginBottom: 12 }}>{['NEEDS', 'GETS', 'YOU WILL SEE'][k]}</Text>
                  <Text style={{ fontSize: 17, lineHeight: 1.35 }}>{cap(b.replace(/^(Needs|Gets|You will see):\s*/i, ''))}</Text>
                </View>))}</View>
            )}
            {['bullets', 'text', 'news'].includes(d.kind) && !(d.constituent && d.bullets.length >= 3) && (
              <View>{d.bullets.map((b, k) => (<View key={k} style={s.bullet}><Text style={s.dot}>•</Text><Text style={[s.btext, { fontSize: d.bullets.length > 5 ? 15 : 20 }]}>{b}</Text></View>))}</View>
            )}
            <Footer n={n} />
          </Page>
        )
      })}
    </Document>
  )
  return renderToBuffer(doc)
}
