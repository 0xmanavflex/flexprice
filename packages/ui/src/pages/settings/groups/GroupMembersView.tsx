import type { Charge } from '@fp/domain'
import { ChargeTable } from '../../product-catalog/charges/ChargeTable'
import { SubTabState, type SubTabQuery } from '../../../compositions/detail/SubTabState'
import { EmptyState, Section } from '../../../compositions'
import { DetailTable } from '../../shared/DetailTable'

export interface GroupMember {
  id: string
  name: string
  detail: string
  charge?: Charge
}

/**
 * What a group holds. Without `members` (still loading, or no source) it says
 * so rather than inventing rows; an empty array means the group holds nothing.
 */
export function GroupMembersView({
  kind,
  members,
  priceGroup = false,
  error,
  errorKind,
  onRetry,
}: Partial<SubTabQuery> & {
  priceGroup?: boolean
  /** Lower-case noun the group holds, e.g. "features". */
  kind: string
  members?: GroupMember[] | undefined
}) {
  if (priceGroup) {
    const missing = members?.filter((member) => !member.charge) ?? []
    return (
      <div className="flex flex-col gap-5">
        <ChargeTable
          charges={
            error
              ? []
              : (members ?? []).flatMap((member) =>
                  member.charge ? [{ ...member.charge, displayName: member.name }] : [],
                )
          }
          isLoading={!members && !error}
          error={error}
          errorKind={errorKind}
          onRetry={onRetry}
          hideRowActions
          emptyDescription="This tag holds no available charges."
        />
        {missing.length > 0 ? (
          <Section title="Unavailable members" showTitle>
            <ul className="space-y-2 text-sm">
              {missing.map((member) => (
                <li key={member.id}>
                  <span className="font-mono">{member.id}</span>: Not found
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
      </div>
    )
  }
  if (error) {
    return (
      <Section title="Members">
        <SubTabState
          isLoading={false}
          empty={{ title: `This tag holds no ${kind} yet.` }}
          hasData={false}
          error={error}
          errorKind={errorKind}
          onRetry={onRetry}
        >
          {null}
        </SubTabState>
      </Section>
    )
  }
  if (!members) {
    return (
      <Section title="Members">
        <EmptyState
          scene="settings"
          size="inline"
          title={`Loading the ${kind} in this tag`}
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
        empty={`This tag holds no ${kind} yet.`}
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
