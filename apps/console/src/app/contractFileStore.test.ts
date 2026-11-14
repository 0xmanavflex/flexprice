import { describe, expect, it } from 'vitest'
import { CONTRACT_FILE_TTL_MS, loadContractFile, staleContractFiles } from './contractFileStore'

describe('staleContractFiles', () => {
  const now = 1_000_000_000_000
  const at = (contractId: string, ago: number) => ({ contractId, savedAt: now - ago })

  it('keeps the newest few and drops the rest', () => {
    const entries = [at('a', 5), at('b', 1), at('c', 3), at('d', 2), at('e', 4)]
    expect(staleContractFiles(entries, now, 3)).toEqual(['e', 'a'])
  })

  it('drops files older than the time limit, even among the newest', () => {
    const entries = [at('fresh', 1), at('old', CONTRACT_FILE_TTL_MS + 1)]
    expect(staleContractFiles(entries, now)).toEqual(['old'])
  })

  it('keeps everything within both limits', () => {
    expect(staleContractFiles([at('a', 1), at('b', 2)], now)).toEqual([])
  })
})

describe('loadContractFile', () => {
  it('fails soft where there is no IndexedDB', async () => {
    await expect(loadContractFile('ctr_01')).resolves.toBeNull()
  })
})
