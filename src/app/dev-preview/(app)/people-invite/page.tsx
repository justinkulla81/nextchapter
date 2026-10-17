import { YourPeople } from '@/components/supporters/YourPeople'

export default function PeopleInvitePreview() {
  return <YourPeople need="none" inviteOpen people={[{ id: '2', name: 'Dana', relationship: 'friend', level: 'weekly', last: null }]} />
}
