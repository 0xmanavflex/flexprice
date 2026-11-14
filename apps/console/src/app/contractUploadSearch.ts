import type { CONTRACT_UPLOAD_STEPS } from '@fp/ui/pages'

/**
 * The URL of `/contracts/upload`: which step, and which uploaded contract.
 *
 * `?step=` mirrors `/contracts/new` so steps 2–5 slot in later; only Upload
 * exists today, and it is the default, so it is left out of the URL.
 * `?contract=` is the contract the upload created: a reload keeps polling it
 * instead of losing the extraction. A hand-edited URL degrades to a fresh
 * upload rather than throwing.
 */
export type ContractUploadStepId = (typeof CONTRACT_UPLOAD_STEPS)[number]['id']

export interface ContractUploadSearch {
  step?: ContractUploadStepId
  contract?: string
}

/** Steps that exist. The rest are in the stepper, locked. */
const BUILT_STEPS: readonly ContractUploadStepId[] = ['upload']
const DEFAULT_STEP: ContractUploadStepId = 'upload'
/** Contract ids are prefixed ULIDs; anything else is not one. */
const CONTRACT_ID = /^[A-Za-z0-9_-]{1,64}$/

export function parseContractUploadSearch(search: Record<string, unknown>): ContractUploadSearch {
  const step = search['step']
  const contract = search['contract']
  const parsed: ContractUploadSearch = {}
  if (
    typeof step === 'string' &&
    step !== DEFAULT_STEP &&
    (BUILT_STEPS as readonly string[]).includes(step)
  ) {
    parsed.step = step as ContractUploadStepId
  }
  if (typeof contract === 'string' && CONTRACT_ID.test(contract)) parsed.contract = contract
  return parsed
}
