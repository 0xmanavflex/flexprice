import { CSVBoxButton } from '@csvbox/react'
import { RBAC_ENTITY } from '@fp/domain'
import {
  type EventImportUpload,
  serverReason,
  useCreateEventImport,
  useCurrentUser,
} from '@fp/query'
import { UploadIcon } from '@fp/ui/icons'
import { Button } from '@fp/ui/primitives'
import { useWriteAccess } from '@fp/ui/compositions'
import { toast } from '@fp/ui/pages'
import { useSession } from '@/app/session'

/**
 * CSV Box's license key for the usage-events sheet: V1's, and a public client
 * identifier rather than a secret. The sheet defines the columns CSV Box checks
 * and where it writes the file (the Flexprice-managed imports bucket).
 */
const EVENTS_LICENSE_KEY = 'Nd50fKMwC54Ri7AoD4ifG1dxL7koqW'

/** What CSV Box passes `onImport`; only the fields read here. */
interface CsvBoxImportMeta {
  import_id?: number | string
  original_filename?: string
}

/**
 * The backend's two named refusals of a CSV Box upload, as sentences; anything
 * else is the server's own reason.
 */
export function importFailure(cause: unknown): string {
  const reason = serverReason(cause) ?? ''
  const lower = reason.toLowerCase()
  if (lower.includes('csv imports are not configured')) {
    return 'CSV imports are not set up for this environment. Contact Flexprice support.'
  }
  if (lower.includes('invalid upload_id')) {
    return 'The upload could not be found. Import the file again.'
  }
  return reason || 'Could not start the import. Try again.'
}

export interface CsvBoxImportButtonProps {
  /** Filled for the page's one create action; outline beside other actions. */
  variant?: 'default' | 'outline'
  /** After the import task is created. */
  onStarted?: (upload: EventImportUpload) => void
}

/**
 * Import CSV: opens CSV Box, which checks the file's columns and uploads it,
 * then starts the import (`POST /tasks`).
 *
 * CSV Box names the uploaded object `<upload_id>_<user_id>.csv`, and the
 * backend looks for it under `<tenant_id>__<environment_id>`, so that pair is
 * the CSV Box user. Without both the button stays disabled: an upload under any
 * other name would never be found. `lazy` keeps CSV Box's iframe off the page
 * until the first click.
 */
export function CsvBoxImportButton({ variant = 'default', onStarted }: CsvBoxImportButtonProps) {
  const { session, environmentId } = useSession()
  const tenantId = useCurrentUser(session?.token ?? null).data?.tenantId ?? ''
  const write = useWriteAccess(RBAC_ENTITY.Task)
  const create = useCreateEventImport()
  const csvBoxUser = tenantId && environmentId ? `${tenantId}__${environmentId}` : ''

  const start = (meta: CsvBoxImportMeta) => {
    const upload: EventImportUpload = {
      uploadId: meta.import_id === undefined ? '' : String(meta.import_id),
      fileName: meta.original_filename ?? '',
    }
    create.mutate(upload, {
      onSuccess: () => {
        toast.success(`Importing ${upload.fileName || 'your file'}`, {
          description: 'Rows appear in the Events debugger as they are ingested.',
        })
        onStarted?.(upload)
      },
      onError: (cause) => void toast.error(importFailure(cause)),
    })
  }

  // Outline sits in a toolbar beside Reload, so it takes that button's size.
  const size = variant === 'outline' ? { size: 'sm' as const, className: 'h-8 px-3' } : {}
  const label = (
    <>
      <UploadIcon aria-hidden />
      Import CSV
    </>
  )

  if (!write.allowed || !csvBoxUser) {
    return (
      <Button
        variant={variant}
        {...size}
        disabled
        title={write.reason ?? 'Loading your workspace…'}
        aria-label="Import CSV"
      >
        {label}
      </Button>
    )
  }

  return (
    <CSVBoxButton
      // A new user remounts CSV Box: its iframe is bound to the user it started with.
      key={csvBoxUser}
      lazy
      licenseKey={EVENTS_LICENSE_KEY}
      user={{ user_id: csvBoxUser }}
      onImport={(ok: boolean, meta?: CsvBoxImportMeta) => {
        if (ok && meta) start(meta)
        else
          toast.error(`${meta?.original_filename ?? 'The file'} could not be uploaded. Try again.`)
      }}
      render={(launch: () => void, isLoading: boolean) => (
        <Button
          variant={variant}
          {...size}
          onClick={() => launch()}
          disabled={isLoading || create.isPending}
        >
          {label}
        </Button>
      )}
    />
  )
}
