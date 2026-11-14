import {
  CONTRACT_DOCUMENT_TYPE_LABEL,
  CONTRACT_TYPE_DESCRIPTION,
  CONTRACT_TYPE_LABEL,
  CONTRACT_UPLOAD_ACCEPT,
  CONTRACT_UPLOAD_LIMITS_LABEL,
  CONTRACT_UPLOAD_MAX_BYTES,
  type ContractExtraction,
  type ContractHighlight,
  type ContractType,
  type UploadedContract,
  contractPageRangeLabel,
} from '@fp/domain'
import { useState } from 'react'
import { ArrowRightIcon, CircleAlertIcon, FileTextIcon, RotateCcwIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@ui/components/primitives/empty'
import { FieldLegend, FieldSet } from '@ui/components/primitives/field'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@ui/components/primitives/item'
import { RadioGroup, RadioGroupItem } from '@ui/components/primitives/radio-group'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { Spinner } from '@ui/components/primitives/spinner'
import { Alert, AlertDescription, AlertTitle } from '@ui/components/reui/alert'
import { Badge } from '@ui/components/reui/badge'
import { FileDropzone, FileRow, formatFileSize } from '@ui/compositions/forms/FileDropzone'
import { WorkflowStepper, type WorkflowStep } from '@ui/compositions/forms/WorkflowStepper'
import {
  DocumentViewer,
  type DocumentHighlightFilter,
} from '@ui/compositions/layout/DocumentViewer'
import { SplitWorkspace, WorkspaceBar } from '@ui/compositions/layout/SplitWorkspace'
import { cn } from '@ui/lib/cn'
import { Pill } from '@ui/pages/shared/cells'

/**
 * Upload a contract, step 1: add the file, let Flexprice AI read it, confirm
 * what kind of contract it is.
 *
 * A full-window workspace (no sidebar): the contract drawn as pages on the
 * left, the step on the right, back and the steps in the bar above.
 *
 * Presentational. The route uploads the file, polls the contract and passes
 * the state down; every state below renders in a story from props alone.
 * Steps 2–5 are in the stepper so the shape of the flow is visible, and locked
 * until they exist.
 */

export type ContractUploadState =
  /** No file yet. */
  | 'empty'
  /** The file is being sent. */
  | 'uploading'
  /** Stored; Flexprice AI is reading it (`pending` / `processing`). */
  | 'reading'
  /** Extraction completed. */
  | 'read'
  /** Extraction failed; `contract.extractionError` says why. */
  | 'failed'

export const CONTRACT_UPLOAD_STEPS = [
  { id: 'upload', title: 'Upload' },
  { id: 'customer', title: 'Customer' },
  { id: 'charges', title: 'Charges' },
  { id: 'billing', title: 'Billing' },
  { id: 'review', title: 'Review' },
] as const

export interface ContractUploadPageProps {
  state: ContractUploadState
  /** The file the user chose, for the preview. Null when this browser has no copy of it. */
  file: File | null
  /** The contract the upload created, once the upload has answered. */
  contract: UploadedContract | null
  /** Why the upload itself was refused (type, size, uploads not configured). Shown under the drop area. */
  uploadError?: string | null | undefined
  /**
   * The contract could not be loaded (deleted, no access, offline). Shown in
   * the `failed` state in place of the extraction error.
   */
  readError?: string | null | undefined
  /** Polling stopped with the extraction still running. */
  stillWorking?: boolean | undefined
  /** The chosen contract type; the route preselects Flexprice AI's guess. */
  contractType: ContractType | null
  onContractTypeChange: (type: ContractType) => void
  onSelectFile: (file: File) => void
  /** Back to an empty step, to choose another file. */
  onReplace: () => void
  /** Back to the Contracts list. */
  onBack: () => void
  /** Omitted until the next step exists; Continue stays disabled without it. */
  onContinue?: (() => void) | undefined
  /** Where each term was read from, drawn on the pages once the contract is read. In reading order. */
  highlights?: readonly ContractHighlight[] | undefined
  /** The selected term: scrolled to and emphasised on the page. */
  activeHighlightId?: string | null | undefined
  onHighlightSelect?: ((id: string) => void) | undefined
  highlightFilter?: DocumentHighlightFilter | undefined
  onHighlightFilterChange?: ((filter: DocumentHighlightFilter) => void) | undefined
}

const STEPS: WorkflowStep[] = CONTRACT_UPLOAD_STEPS.map((step) => ({
  ...step,
  status: step.id === 'upload' ? 'current' : 'locked',
}))

const DESCRIPTION: Record<ContractUploadState, string> = {
  empty:
    'Start by adding the agreement. Flexprice AI reads it and fills in every step for you to confirm.',
  uploading: 'Sending the file to Flexprice.',
  reading: 'Flexprice AI is reading the contract. You confirm everything it finds.',
  read: 'Tell Flexprice AI what kind of contract this is.',
  failed: 'Flexprice AI could not read this file.',
}

export function ContractUploadPage({
  state,
  file,
  contract,
  uploadError,
  readError,
  stillWorking = false,
  contractType,
  onContractTypeChange,
  onSelectFile,
  onReplace,
  onBack,
  onContinue,
  highlights = NO_HIGHLIGHTS,
  activeHighlightId = null,
  onHighlightSelect,
  highlightFilter = 'all',
  onHighlightFilterChange,
}: ContractUploadPageProps) {
  const canContinue = state === 'read' && contractType !== null && Boolean(onContinue)
  // A new object each time, so the same page can be jumped to twice.
  const [jumpTo, setJumpTo] = useState<{ page: number } | null>(null)
  const read = state === 'read'

  return (
    <div className="bg-background flex min-h-0 flex-1 flex-col">
      <WorkspaceBar
        backLabel="Back to contracts"
        onBack={onBack}
        title="Upload contract"
        steps={
          <WorkflowStepper
            variant="header"
            showTitles
            steps={STEPS}
            currentStep="upload"
            // Every other step is locked, so the stepper never asks to move.
            onStepChange={() => undefined}
            aria-label="Contract steps"
          />
        }
        actions={
          <Button type="button" disabled={!canContinue} onClick={onContinue}>
            Continue
            <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
          </Button>
        }
      />
      <SplitWorkspace
        documentLabel="Contract"
        title="Upload a contract"
        description={DESCRIPTION[state]}
        documentHeader={
          state === 'empty' ? undefined : (
            <DocumentStrip state={state} file={file} contract={contract} />
          )
        }
        document={
          <DocumentViewer
            source={state !== 'empty' && file ? { file } : null}
            empty={<DocumentEmpty state={state} contract={contract} />}
            scanning={state === 'uploading' || state === 'reading'}
            highlights={read ? highlights : undefined}
            activeId={read ? activeHighlightId : null}
            onSelect={onHighlightSelect}
            filter={highlightFilter}
            onFilterChange={onHighlightFilterChange}
            jumpTo={jumpTo}
          />
        }
      >
        <StepBody
          state={state}
          file={file}
          contract={contract}
          uploadError={uploadError}
          readError={readError}
          stillWorking={stillWorking}
          contractType={contractType}
          onContractTypeChange={onContractTypeChange}
          onSelectFile={onSelectFile}
          onReplace={onReplace}
          // Only a file on screen can be jumped through.
          onJumpToPage={file ? (page) => setJumpTo({ page }) : undefined}
        />
      </SplitWorkspace>
    </div>
  )
}

/** The strip above the pages: which file, how big, and where reading is. */
function DocumentStrip({
  state,
  file,
  contract,
}: {
  state: ContractUploadState
  file: File | null
  contract: UploadedContract | null
}) {
  const name = file?.name ?? contract?.document?.fileName ?? 'Contract'
  const bytes = file?.size ?? contract?.document?.sizeBytes ?? null
  const pages = contract?.extraction?.pages ?? null
  const detail = [
    bytes === null ? null : formatFileSize(bytes),
    pages === null ? null : `${pages} ${pages === 1 ? 'page' : 'pages'}`,
    STRIP_STATUS[state],
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <FileRow
      variant="plain"
      name={name}
      detail={detail}
      status={
        state === 'read' ? (
          <Pill tone="success">Read</Pill>
        ) : state === 'failed' ? (
          <Pill tone="danger">Not read</Pill>
        ) : (
          <Pill tone="info" icon={<Spinner className="size-3" aria-hidden />}>
            {state === 'uploading' ? 'Uploading' : 'Reading'}
          </Pill>
        )
      }
    />
  )
}

const STRIP_STATUS: Record<ContractUploadState, string | null> = {
  empty: null,
  uploading: 'sending',
  reading: 'reading the contract',
  read: 'terms found',
  failed: 'could not be read',
}

/** The left pane before there is anything to preview. */
function DocumentEmpty({
  state,
  contract,
}: {
  state: ContractUploadState
  contract: UploadedContract | null
}) {
  const name = contract?.document?.fileName
  return (
    <Empty className="m-6 flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileTextIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{state !== 'empty' && name ? name : 'Drop a contract to begin'}</EmptyTitle>
        <EmptyDescription>
          {state !== 'empty' && name
            ? 'This browser has no copy of the file to show. The preview appears in the browser it was uploaded from.'
            : 'Flexprice AI finds the customer, charges, billing and renewal terms, and shows you where each one came from before you confirm.'}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

const NO_HIGHLIGHTS: readonly ContractHighlight[] = []

type StepBodyProps = Omit<
  ContractUploadPageProps,
  | 'onBack'
  | 'onContinue'
  | 'highlights'
  | 'activeHighlightId'
  | 'onHighlightSelect'
  | 'highlightFilter'
  | 'onHighlightFilterChange'
> & {
  onJumpToPage?: ((page: number) => void) | undefined
}

function StepBody({
  state,
  file,
  contract,
  uploadError,
  readError,
  stillWorking,
  contractType,
  onContractTypeChange,
  onSelectFile,
  onReplace,
  onJumpToPage,
}: StepBodyProps) {
  if (state === 'empty') {
    return (
      <FileDropzone
        title="Drop a contract to begin"
        hint={CONTRACT_UPLOAD_LIMITS_LABEL}
        accept={CONTRACT_UPLOAD_ACCEPT}
        maxSize={CONTRACT_UPLOAD_MAX_BYTES}
        error={uploadError}
        onSelect={onSelectFile}
      />
    )
  }

  const name = file?.name ?? contract?.document?.fileName ?? 'Contract'
  const bytes = file?.size ?? contract?.document?.sizeBytes ?? null
  const size = bytes === null ? null : formatFileSize(bytes)
  const replace = (
    <Button type="button" variant="outline" size="sm" className="h-7 px-2.5" onClick={onReplace}>
      <RotateCcwIcon aria-hidden />
      Replace
    </Button>
  )

  if (state === 'uploading') {
    return (
      <FileRow
        name={name}
        detail={[size, 'Uploading'].filter(Boolean).join(' · ')}
        status={<Spinner className="size-3.5" aria-label="Uploading" />}
      />
    )
  }

  if (state === 'reading') {
    return (
      <>
        <FileRow
          name={name}
          detail={size}
          status={<Pill tone="info">Reading</Pill>}
          actions={replace}
        />
        <div role="status" aria-live="polite" className="flex items-start gap-2.5 text-[13px]">
          <Spinner className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="ai-shimmer font-medium">Reading the contract</span>
            <span className="text-muted-foreground">
              Flexprice AI reads the text, works out which documents are in the file and extracts
              the terms. This usually takes 15–20 seconds.
            </span>
          </span>
        </div>
        <ReadingPlaceholder />
        {stillWorking ? (
          <Alert variant="info">
            <CircleAlertIcon aria-hidden />
            <AlertTitle>Still working</AlertTitle>
            <AlertDescription>
              This contract is taking longer than usual. Keep this link and come back to it; the
              terms will be here once Flexprice AI has finished.
            </AlertDescription>
          </Alert>
        ) : null}
      </>
    )
  }

  if (state === 'failed') {
    return (
      <>
        <FileRow name={name} detail={size} status={<Pill tone="danger">Not read</Pill>} />
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden />
          <AlertTitle>Flexprice AI couldn’t read this file</AlertTitle>
          <AlertDescription>
            {readError || contract?.extractionError || 'Something went wrong while reading it.'}
          </AlertDescription>
        </Alert>
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-3"
            onClick={onReplace}
          >
            <RotateCcwIcon aria-hidden />
            Upload another file
          </Button>
        </div>
      </>
    )
  }

  const extraction = contract?.extraction ?? null
  return (
    <>
      <FileRow
        name={name}
        detail={readSummary(extraction)}
        status={<Pill tone="success">Terms found</Pill>}
        actions={replace}
      />
      {extraction && extraction.documents.length > 0 ? (
        <FieldSet className="min-w-0 gap-0">
          <FieldLegend variant="label">Documents in this file</FieldLegend>
          <ItemGroup className="gap-1.5">
            {extraction.documents.map((doc, index) => (
              <Item key={`${doc.type}-${index}`} role="listitem" variant="outline" size="xs">
                <ItemMedia variant="icon" className="text-muted-foreground">
                  <FileTextIcon aria-hidden />
                </ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle>{CONTRACT_DOCUMENT_TYPE_LABEL[doc.type]}</ItemTitle>
                  {doc.title ? (
                    <ItemDescription className="truncate">{doc.title}</ItemDescription>
                  ) : null}
                </ItemContent>
                <ItemActions className="text-muted-foreground text-xs tabular-nums">
                  {onJumpToPage && doc.pageStart !== null ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="text-muted-foreground tabular-nums"
                      aria-label={`Show ${CONTRACT_DOCUMENT_TYPE_LABEL[doc.type]}, ${contractPageRangeLabel(doc.pageStart, doc.pageEnd)}`}
                      onClick={() => onJumpToPage(doc.pageStart ?? 1)}
                    >
                      {contractPageRangeLabel(doc.pageStart, doc.pageEnd)}
                    </Button>
                  ) : (
                    contractPageRangeLabel(doc.pageStart, doc.pageEnd)
                  )}
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        </FieldSet>
      ) : null}
      <ContractTypeChoice
        value={contractType}
        guess={extraction?.contractType?.value ?? null}
        onChange={onContractTypeChange}
      />
    </>
  )
}

/**
 * While the contract is read: the shape of what is coming, sweeping, so the
 * panel fills in place rather than appearing from nothing.
 */
function ReadingPlaceholder() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground text-sm">Documents in this file</span>
        <Skeleton className="ai-sweep h-12 rounded-md" />
        <Skeleton className="ai-sweep h-12 rounded-md" />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground text-sm">Contract type</span>
        <Skeleton className="ai-sweep h-16 rounded-md" />
      </div>
    </div>
  )
}

/** "41 terms from 13 pages · 3 to check". */
function readSummary(extraction: ContractExtraction | null): string {
  if (!extraction) return 'Read'
  const parts: string[] = []
  const { fields, pages, toCheck } = extraction
  if (fields !== null && pages !== null) {
    parts.push(
      `${fields} ${fields === 1 ? 'term' : 'terms'} from ${pages} ${pages === 1 ? 'page' : 'pages'}`,
    )
  } else if (fields !== null) {
    parts.push(`${fields} ${fields === 1 ? 'term' : 'terms'}`)
  }
  if (toCheck.total > 0) parts.push(`${toCheck.total} to check`)
  return parts.join(' · ') || 'Read'
}

const CONTRACT_TYPES = Object.keys(CONTRACT_TYPE_LABEL) as ContractType[]

function ContractTypeChoice({
  value,
  guess,
  onChange,
}: {
  value: ContractType | null
  guess: ContractType | null
  onChange: (type: ContractType) => void
}) {
  return (
    <FieldSet className="min-w-0 gap-0">
      <FieldLegend variant="label">Contract type</FieldLegend>
      <RadioGroup
        value={value ?? ''}
        onValueChange={(next) => onChange(next as ContractType)}
        className="flex flex-col gap-1.5"
      >
        {CONTRACT_TYPES.map((type) => (
          <label
            key={type}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors',
              value === type ? 'border-primary/60 bg-primary/4' : 'hover:bg-muted/40',
            )}
          >
            <RadioGroupItem value={type} className="mt-0.5" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-2 text-[13px] font-medium">
                {CONTRACT_TYPE_LABEL[type]}
                {type === guess ? (
                  <Badge variant="info-light" size="sm">
                    Flexprice AI’s guess
                  </Badge>
                ) : null}
              </span>
              <span className="text-muted-foreground text-xs">
                {CONTRACT_TYPE_DESCRIPTION[type]}
              </span>
            </span>
          </label>
        ))}
      </RadioGroup>
    </FieldSet>
  )
}
