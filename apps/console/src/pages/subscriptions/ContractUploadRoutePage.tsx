import { useEffect, useMemo, useState } from 'react'
import {
  type ContractType,
  collectContractHighlights,
  isContractExtractionActive,
} from '@fp/domain'
import { ApiError, serverReason, useUploadContract, useUploadedContract } from '@fp/query'
import {
  ContractUploadPage,
  type ContractUploadState,
  type DocumentHighlightFilter,
} from '@fp/ui/pages'
import { forgetContractFile, loadContractFile, saveContractFile } from '../../app/contractFileStore'
import { toListFailure } from '../shared/listFailure'

export interface ContractUploadRoutePageProps {
  /** The contract the upload created, from the URL, so a reload resumes polling. */
  contractId: string | null
  /** Writes the contract id into the URL (null clears it, for Replace). */
  onContractChange: (contractId: string | null) => void
  onBack: () => void
}

/** Why an upload was refused, as a sentence. The backend's hint when it sent one. */
export function uploadFailure(error: unknown): string | null {
  if (!error) return null
  const reason = serverReason(error)
  if (reason) return reason
  if (error instanceof ApiError) {
    if (error.kind === 'cancelled') return null
    if (error.kind === 'timeout') {
      return 'The upload took too long. Check your connection and try again.'
    }
    if (error.kind === 'network') return 'Could not reach Flexprice. Try again.'
  }
  return 'Could not upload the file. Try again.'
}

/**
 * The wiring layer for `/contracts/upload`: uploads the chosen file, polls the
 * contract it created, and hands the page plain props.
 *
 * The contract id lives in the URL, so a reload resumes the extraction. The
 * file (the preview) is kept in this browser too, since the backend cannot
 * hand it back: a reload shows it again; another browser shows the contract
 * without it.
 */
export function ContractUploadRoutePage({
  contractId,
  onContractChange,
  onBack,
}: ContractUploadRoutePageProps) {
  const [file, setFile] = useState<File | null>(null)
  const [chosenType, setChosenType] = useState<ContractType | null>(null)
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null)
  const [highlightFilter, setHighlightFilter] = useState<DocumentHighlightFilter>('all')
  const upload = useUploadContract()
  const contract = useUploadedContract(contractId)

  const data = contract.data ?? null

  // After a reload: bring back this browser's copy of the file, if it kept one.
  useEffect(() => {
    if (!contractId || file) return
    let cancelled = false
    void loadContractFile(contractId).then((kept) => {
      if (!cancelled && kept) setFile(kept)
    })
    return () => {
      cancelled = true
    }
    // Only when the contract changes; a file chosen here is already in state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId])

  // A kept copy is shown only if it is the file the contract was made from.
  // Size, not name: the server may normalise the name's characters.
  const storedSize = data?.document?.sizeBytes
  const preview = file && storedSize && storedSize !== file.size ? null : file
  const readFailure = contractId ? toListFailure(contract.error, 'this contract') : null

  let state: ContractUploadState = 'empty'
  if (upload.isPending) state = 'uploading'
  else if (contractId) {
    if (readFailure && !data) state = 'failed'
    else if (!data || isContractExtractionActive(data.extractionStatus)) state = 'reading'
    else state = data.extractionStatus === 'completed' ? 'read' : 'failed'
  }

  const guess = data?.extraction?.contractType?.value ?? null
  const terms = data?.extraction?.terms
  const highlights = useMemo(() => (terms ? collectContractHighlights(terms) : []), [terms])

  return (
    <ContractUploadPage
      state={state}
      file={preview}
      contract={data}
      uploadError={state === 'empty' ? uploadFailure(upload.error) : null}
      readError={readFailure && !data ? readFailure.message : null}
      stillWorking={contract.gaveUp}
      contractType={chosenType ?? guess}
      onContractTypeChange={setChosenType}
      onSelectFile={(next) => {
        setFile(next)
        setChosenType(null)
        upload.mutate(next, {
          onSuccess: (created) => {
            if (created.id) void saveContractFile(created.id, next)
            onContractChange(created.id || null)
          },
        })
      }}
      onReplace={() => {
        upload.reset()
        if (contractId) void forgetContractFile(contractId)
        setFile(null)
        setChosenType(null)
        setActiveHighlightId(null)
        setHighlightFilter('all')
        onContractChange(null)
      }}
      onBack={onBack}
      highlights={highlights}
      activeHighlightId={activeHighlightId}
      onHighlightSelect={setActiveHighlightId}
      highlightFilter={highlightFilter}
      onHighlightFilterChange={setHighlightFilter}
      // Steps 2–5 are not built yet: Continue stays disabled until they are.
    />
  )
}
