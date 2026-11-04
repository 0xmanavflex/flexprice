import {
  EVENT_IMPORT_STATUS,
  EVENT_IMPORT_STATUS_LABEL,
  type EventImport,
  type EventImportStatus,
} from '@fp/domain'
import type { PillTone } from '../../shared/cells'
import { statusTone } from '../../shared/statusTones'

/**
 * An import's status as one pill. A file that finished with rejected rows is
 * not the same as a clean one: the backend calls both `COMPLETED`, so the
 * failed count is what tells them apart.
 */
export function eventImportPill(row: EventImport): { label: string; tone: PillTone } {
  if (row.status === EVENT_IMPORT_STATUS.Completed && (row.failedRecords ?? 0) > 0) {
    return { label: 'Completed with errors', tone: 'warning' }
  }
  return {
    label: EVENT_IMPORT_STATUS_LABEL[row.status as EventImportStatus] ?? (row.status || 'Unknown'),
    tone: statusTone(row.status),
  }
}
