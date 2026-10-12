import { EmptyState, Section } from '../../../compositions'
import { DetailTable } from '../../shared/DetailTable'

export interface GroupMember {
  id: string
  name: string
  detail: string
}

/**
 * What a group holds. Flexprice has no member-entities read yet, so the console
 * passes no `members` and this says so (the group's own count still shows on
 * its tab); it never shows sample rows. Pass the rows (an empty array means
 * none) once a source exists.
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
          title={`The ${kind} in this group are not listed yet`}
          description="Flexprice does not list a group's members yet. The count on the tab is real; the names are not available."
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
