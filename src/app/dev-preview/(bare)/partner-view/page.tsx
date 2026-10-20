import { PartnerView } from '@/components/supporters/PartnerView'

export default function PartnerViewPreview() {
  return (
    <PartnerView
      data={{
        memberFirstName: 'Justin',
        partnerName: 'Alex',
        headline: 'Justin is putting in real work this week: 145 minutes so far.',
        stats: [
          { label: 'Minutes', value: 145 },
          { label: 'Days active', value: 4 },
          { label: 'Actions done', value: 9 },
          { label: 'Messages sent', value: 6 },
        ],
        need: 'listen',
        starters: ['Proud of you', 'Thinking of you', 'Dinner is on me', 'You have got this'],
        ideas: [
          { id: 'a', text: 'Take one household task off Justin’s plate tonight.', done: true },
          { id: 'b', text: 'Offer to be Justin’s practice interviewer for 15 minutes.' },
          { id: 'c', text: 'Plan something fun together this weekend that has nothing to do with work.' },
        ],
      }}
    />
  )
}
