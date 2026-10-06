import { Section } from '../../compositions'
import { DetailTable } from '../shared/DetailTable'

export interface GroupMember {
  id: string
  name: string
  detail: string
}

/** DEMO rows: V2 has no member-entities read hook yet, so real members cannot be listed. */
export const DEMO_GROUP_MEMBERS: GroupMember[] = [
  { id: 'm1', name: 'API requests', detail: 'Metered feature' },
  { id: 'm2', name: 'Seats', detail: 'Static feature' },
  { id: 'm3', name: 'Priority support', detail: 'Boolean feature' },
]

export function GroupMembersView({
  kind,
  count,
  members = DEMO_GROUP_MEMBERS,
}: {
  /** Lower-case noun the group holds, e.g. "features". */
  kind: string
  count: number
  members?: GroupMember[]
}) {
  return (
    <Section title="Members" description={`${count.toLocaleString()} ${kind} in this group`} flush>
      <DetailTable
        label="Members"
        noun="members"
        rows={members}
        getRowId={(m) => m.id}
        empty={`This group holds no ${kind} yet.`}
        columns={[
          {
            key: 'n',
            header: 'Name',
            sortBy: (m) => m.name,
            cell: (m) => <span className="font-medium">{m.name}</span>,
          },
          {
            key: 'd',
            header: 'Type',
            sortBy: (m) => m.detail,
            cell: (m) => <span className="text-muted-foreground">{m.detail}</span>,
          },
        ]}
      />
    </Section>
  )
}
