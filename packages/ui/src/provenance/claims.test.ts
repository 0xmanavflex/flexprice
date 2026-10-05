import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * `provenance({ composes: [...] })` is a claim, and a claim nothing checks is
 * decoration: the library carried 120 of them while pages built their own
 * cards and tables underneath. This reads each file's real imports and fails
 * when a `composes` entry names a part the file does not import.
 */
const SRC = fileURLToPath(new URL('..', import.meta.url))

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === 'components' ? [] : walk(path)
    return /\.tsx$/.test(name) && !/\.(stories|test)\.tsx$/.test(name) ? [path] : []
  })
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

function claimsOf(source: string): string[] {
  const block = /provenance\(\{[^}]*?composes:\s*\[([^\]]*)\]/s.exec(source)
  return block?.[1] ? [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]!) : []
}

function importsOf(source: string): string[] {
  return [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!)
}

/** True when some import in the file plausibly is the claimed part. */
function isBacked(claim: string, imports: string[]): boolean {
  const name = claim.split('/').pop() ?? claim
  if (claim.startsWith('@reui/')) return imports.some((i) => norm(i).includes(norm(name)))
  if (claim.startsWith('ui/')) return imports.some((i) => i.endsWith(`primitives/${name}`))
  return imports.some((i) => norm(i).includes(norm(name)))
}

describe('provenance claims match imports', () => {
  const files = walk(SRC)
  const cases = files.flatMap((file) => {
    const source = readFileSync(file, 'utf8')
    const imports = importsOf(source)
    return claimsOf(source).map((claim) => ({
      file: relative(SRC, file),
      claim,
      backed: isBacked(claim, imports),
    }))
  })

  it('has claims to check', () => {
    expect(cases.length).toBeGreaterThan(50)
  })

  it('every composes entry is imported by the file that claims it', () => {
    const unbacked = cases.filter((c) => !c.backed).map((c) => `${c.file} claims ${c.claim}`)
    expect(unbacked).toEqual([])
  })
})
