import type { ReactNode } from 'react'
import { FileTextIcon, UploadIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@ui/components/primitives/item'
import { useFileUpload } from '@ui/hooks/use-file-upload'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * Picking one file: a drop area with "Browse files", and the row that stands
 * for the file once it is chosen. `DocumentViewer` shows the file itself.
 *
 * The drag, drop, dialog and size/type checks are the vendored ReUI
 * `use-file-upload` hook; this composition only gives them the console's
 * look. It holds no file: the chosen file goes out through `onSelect` and the
 * page decides what happens to it (upload it, show it, replace it), so every
 * state renders in a story from props alone.
 */
export const FileDropzoneProvenance = provenance({
  source: 'composition',
  composes: ['@reui/use-file-upload', 'ui/button', 'ui/item'],
  note: 'Single-file drop area and file row over the vendored ReUI use-file-upload hook. Holds no file; the page owns it.',
})

/** "482 KB", "12.4 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export interface FileDropzoneProps {
  /** Called with the one file the user dropped or picked, once it passes `accept` and `maxSize`. */
  onSelect: (file: File) => void
  /** The input's `accept`: extensions and media types, e.g. `.pdf,application/pdf`. */
  accept?: string
  /** In bytes. A larger file is refused here with a message, before it is sent anywhere. */
  maxSize?: number
  /** The drop area's line, e.g. "Drop a contract to begin". */
  title: string
  /** What is accepted, in words: "PDF, PNG or JPG · up to 20 MB". */
  hint?: string
  disabled?: boolean
  /** A message from outside, e.g. the server refusing the file. Shown under the area. */
  error?: string | null | undefined
  className?: string
}

export function FileDropzone({
  onSelect,
  accept = '*',
  maxSize,
  title,
  hint,
  disabled = false,
  error,
  className,
}: FileDropzoneProps) {
  const [{ isDragging, errors }, actions] = useFileUpload({
    accept,
    multiple: false,
    ...(maxSize ? { maxSize } : {}),
    onFilesAdded: (added) => {
      const file = added[0]?.file
      if (file instanceof File) onSelect(file)
      // The page owns the file; the hook's copy (and its preview URL) is released.
      actions.clearFiles()
    },
  })
  const message = errors[0] ?? error ?? null

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        data-dragging={isDragging || undefined}
        // Disabled reads from the Browse button; dimming the whole area would fail contrast.
        data-disabled={disabled || undefined}
        onDragEnter={disabled ? undefined : actions.handleDragEnter}
        onDragLeave={disabled ? undefined : actions.handleDragLeave}
        onDragOver={disabled ? undefined : actions.handleDragOver}
        onDrop={disabled ? undefined : actions.handleDrop}
        className="bg-background data-[dragging]:border-primary data-[dragging]:bg-muted/50 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center transition-colors"
      >
        <input
          {...actions.getInputProps({ disabled })}
          className="sr-only"
          aria-label={title}
          tabIndex={-1}
        />
        <span className="bg-muted mb-1 flex size-10 items-center justify-center rounded-full">
          <UploadIcon aria-hidden className="size-4" />
        </span>
        <span className="text-sm font-medium">{title}</span>
        {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 h-7 px-2.5"
          onClick={actions.openFileDialog}
          disabled={disabled}
        >
          Browse files
        </Button>
      </div>
      {message ? (
        <p role="alert" className="text-destructive text-[13px]">
          {message}
        </p>
      ) : null}
    </div>
  )
}

export interface FileRowProps {
  name: string
  /** A short line under the name: size, page count, what is happening to it. */
  detail?: ReactNode
  /** A status pill or spinner, beside the actions. */
  status?: ReactNode
  /** Outline/ghost buttons: Replace, Remove. */
  actions?: ReactNode
  /** `plain` drops the border, for a strip that already sits in a bordered pane. */
  variant?: 'outline' | 'plain'
  className?: string
}

/** The one row that stands for a chosen file. */
export function FileRow({
  name,
  detail,
  status,
  actions,
  variant = 'outline',
  className,
}: FileRowProps) {
  return (
    <Item
      variant={variant === 'plain' ? 'default' : 'outline'}
      className={cn(variant === 'plain' && 'px-0 py-0', className)}
    >
      <ItemMedia variant="icon" className="bg-muted text-muted-foreground size-8 rounded-md">
        <FileTextIcon aria-hidden />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full truncate">{name}</ItemTitle>
        {detail ? <ItemDescription>{detail}</ItemDescription> : null}
      </ItemContent>
      {status || actions ? (
        <ItemActions>
          {status}
          {actions}
        </ItemActions>
      ) : null}
    </Item>
  )
}
