import { Section } from '../../compositions'
import { SimpleTable } from '../../compositions/DetailKit'

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
    <Section
      title="Members"
      description={`${count.toLocaleString()} ${kind} in this group. Rows below are sample data until the members read view is wired.`}
    >
      <SimpleTable
        rows={members}
        getRowId={(m) => m.id}
        empty={`This group holds no ${kind} yet.`}
        columns={[
          { key: 'n', header: 'Name', cell: (m) => m.name },
          { key: 'd', header: 'Type', cell: (m) => m.detail },
        ]}
      />
    </Section>
  )
}
