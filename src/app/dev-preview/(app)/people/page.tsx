import { YourPeople } from '@/components/supporters/YourPeople'

export default function PeoplePreview() {
  return (
    <YourPeople
      need="listen"
      inviteOpen={false}
      people={[
        { id: '1', name: 'Alex', relationship: 'partner', level: 'close', last: 'Sent a cheer yesterday' },
        { id: '2', name: 'Dana', relationship: 'friend', level: 'weekly', last: null },
      ]}
    />
  )
}
