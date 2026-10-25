import type { UsageSync } from '@fp/domain'
import {
  CodeBlock,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from '@ui/components/reui/code-block/code-block'
import { DetailList } from '@ui/compositions/tables/DetailList'
import { Pill } from '../../shared/cells'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@ui/components/primitives/sheet'
import { provenance } from '@ui/provenance'
import { providerLabel } from './usageSyncProviders'

/**
 * Where one usage record was reported, opened from the Usage Syncs list.
 *
 * Each marketplace the record reached (or was skipped for) is a titled block
 * with its sync entry as the JSON the API returned, in the ReUI `CodeBlock`
 * unchanged: the point is reconciling against the marketplace's own record,
 * so nothing here reformats it.
 */
export const UsageSyncDetailSheetProvenance = provenance({
  source: 'composition',
  composes: ['primitives/sheet', 'compositions/DetailList', 'reui/code-block'],
  note: 'Read-only usage record detail: identifying fields plus one JSON block per marketplace.',
})

export interface UsageSyncDetailSheetProps {
  /** The record to show. `null` closes the sheet. */
  usageSync: UsageSync | null
  onClose: () => void
}

export function UsageSyncDetailSheet({ usageSync, onClose }: UsageSyncDetailSheetProps) {
  return (
    <Sheet open={usageSync !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        {usageSync ? (
          <>
            <SheetHeader>
              <SheetTitle>Usage sync</SheetTitle>
              <SheetDescription>
                {usageSync.customerExternalId || usageSync.customerId || usageSync.id}
              </SheetDescription>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
              <DetailList
                items={[
                  {
                    label: 'Record ID',
                    value: <span className="font-mono text-xs">{usageSync.id || '—'}</span>,
                  },
                  {
                    label: 'Contract',
                    value: (
                      <span className="font-mono text-xs">{usageSync.subscriptionId || '—'}</span>
                    ),
                  },
                  {
                    label: 'Plan',
                    value: <span className="font-mono text-xs">{usageSync.planId || '—'}</span>,
                  },
                ]}
              />
              {usageSync.syncs.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  This usage has not been reported to any marketplace.
                </p>
              ) : (
                usageSync.syncs.map((entry) => (
                  <div key={entry.provider} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{providerLabel(entry.provider)}</span>
                      <Pill tone={entry.skipped ? 'warning' : 'success'}>
                        {entry.skipped ? 'Skipped' : 'Synced'}
                      </Pill>
                    </div>
                    <CodeBlock
                      code={JSON.stringify(
                        {
                          agreement_id: entry.agreementId,
                          reporting_id: entry.reportingId,
                          connection_id: entry.connectionId,
                          synced_at: entry.syncedAt?.toISOString() ?? null,
                          ...(entry.skipped ? { skip_reason: entry.skipReason } : {}),
                        },
                        null,
                        2,
                      )}
                      language="json"
                      label={`${providerLabel(entry.provider)} sync entry`}
                    >
                      <CodeBlockHeader>
                        <CodeBlockTitle>{entry.provider}</CodeBlockTitle>
                        <CodeBlockCopyButton className="ml-auto" />
                      </CodeBlockHeader>
                    </CodeBlock>
                  </div>
                ))
              )}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
