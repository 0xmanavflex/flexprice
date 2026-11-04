import { describe, expect, it } from 'vitest'
import { parseEnvironmentParam } from './environmentParam'

describe('parseEnvironmentParam', () => {
  it('reads a non-empty environment id', () => {
    expect(parseEnvironmentParam({ env: 'env_1' })).toEqual({ env: 'env_1' })
    expect(parseEnvironmentParam({ env: '  env_1 ' })).toEqual({ env: 'env_1' })
  })

  it('ignores a missing, blank or non-string value', () => {
    expect(parseEnvironmentParam({})).toEqual({})
    expect(parseEnvironmentParam({ env: '  ' })).toEqual({})
    expect(parseEnvironmentParam({ env: 42 })).toEqual({})
  })
})
