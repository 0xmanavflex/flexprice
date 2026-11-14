import { describe, expect, it } from 'vitest'
import { parseContractUploadSearch } from './contractUploadSearch'

describe('parseContractUploadSearch', () => {
  it('keeps a contract id, so a reload resumes the extraction', () => {
    expect(parseContractUploadSearch({ contract: 'contract_01JABC' })).toEqual({
      contract: 'contract_01JABC',
    })
  })

  it('leaves the default step out of the URL', () => {
    expect(parseContractUploadSearch({ step: 'upload' })).toEqual({})
  })

  it('drops a step that is not built yet, and anything hand-edited', () => {
    expect(parseContractUploadSearch({ step: 'billing' })).toEqual({})
    expect(parseContractUploadSearch({ step: 3, contract: '../../x' })).toEqual({})
    expect(parseContractUploadSearch({ contract: '' })).toEqual({})
  })
})
