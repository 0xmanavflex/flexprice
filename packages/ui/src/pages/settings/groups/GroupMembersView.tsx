import { EmptyState, Section } from '../../../compositions'
import { DetailTable } from '../../shared/DetailTable'

export interface GroupMember {
  id: string
  name: string
  detail: string
}

/**
 * What a group holds. Without `members` (still loading, or no source) it says
 * so rather than inventing rows; an empty array means the group holds nothing.
 */
export function GroupMembersView({
  kind,
  members,
}: {
  /** Lower-case noun the group holds, e.g. "features". */
  kind: string
  members?: GroupMember[] | undefined
}) {
  if (!members) {
    return (
      <Section title="Members">
        <EmptyState
          scene="settings"
          size="inline"
          title={`Loading the ${kind} in this group`}
          description="Their names appear here once they load."
        />
      </Section>
    )
  }
  return (
    <Section table title="Members">
      <DetailTable
        compact
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
