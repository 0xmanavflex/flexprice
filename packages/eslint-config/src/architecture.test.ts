import { describe, expect, it } from 'vitest'
import { ESLint } from 'eslint'
import { architecture } from './architecture'

/**
 * Lints a snippet as if it lived at `filePath`, and returns the messages.
 *
 * The rules are path-scoped, so the only way to know a rule fires is to lint a
 * file at the path it guards. A config asserted against itself proves nothing.
 */
async function lintAt(filePath: string, code: string): Promise<string[]> {
  const eslint = new ESLint({
    cwd: '/repo',
    overrideConfigFile: true,
    overrideConfig: architecture as never,
  })
  const [result] = await eslint.lintText(code, { filePath: `/repo/${filePath}` })
  return (result?.messages ?? []).map((m) => m.message)
}

const IMPORTS = {
  sdk: "import { Flexprice } from '@flexprice/sdk'",
  api: "import { ApiError } from '@fp/api'",
  query: "import { queryKeys } from '@fp/query'",
  reactQuery: "import { useQuery } from '@tanstack/react-query'",
  ui: "import { Source } from '@fp/ui'",
  actions: "import { defineAction } from '@fp/actions'",
  domain: "import { money } from '@fp/domain'",
  react: "import { useState } from 'react'",
  adapter: "import { SHIMS } from '@fp/sdk-adapter'",
  dataGrid: "import { DataGrid } from '@ui/components/reui/data-grid/data-grid'",
  filters: "import { createFilterQuery } from '@ui/components/reui/filters/filters-query'",
}

describe('UI is presentation', () => {
  it.each([
    ['the SDK', IMPORTS.sdk],
    ['@fp/api', IMPORTS.api],
    ['@fp/query', IMPORTS.query],
    ['react-query directly', IMPORTS.reactQuery],
    ['actions', IMPORTS.actions],
  ])('refuses %s', async (_label, code) => {
    expect(await lintAt('packages/ui/src/flexprice/Thing.tsx', code)).toHaveLength(1)
  })

  it('allows domain types and React', async () => {
    const code = [IMPORTS.domain, IMPORTS.react].join('\n')
    expect(await lintAt('packages/ui/src/flexprice/Thing.tsx', code)).toEqual([])
  })

  it('explains what to do instead, not just that it is wrong', async () => {
    const [message] = await lintAt('packages/ui/src/flexprice/Thing.tsx', IMPORTS.query)
    expect(message).toMatch(/pass the result down|page/i)
  })
})

describe('domain is pure', () => {
  it.each([
    ['React', IMPORTS.react],
    ['UI', IMPORTS.ui],
    ['query', IMPORTS.query],
    ['the SDK', IMPORTS.sdk],
  ])('refuses %s', async (_label, code) => {
    expect(await lintAt('packages/domain/src/money.ts', code)).toHaveLength(1)
  })
})

describe('query owns server state', () => {
  it('may reach the SDK and @fp/api', async () => {
    const code = [IMPORTS.sdk, IMPORTS.api, IMPORTS.domain].join('\n')
    expect(await lintAt('packages/query/src/customers.ts', code)).toEqual([])
  })

  it('may use the temporary adapter — it is the only layer that may', async () => {
    expect(await lintAt('packages/query/src/customers.ts', IMPORTS.adapter)).toEqual([])
  })

  it('refuses UI', async () => {
    expect(await lintAt('packages/query/src/customers.ts', IMPORTS.ui)).toHaveLength(1)
  })
})

describe('actions describe capabilities', () => {
  it('may use domain and query', async () => {
    const code = [IMPORTS.domain, IMPORTS.query].join('\n')
    expect(await lintAt('packages/actions/src/billing.ts', code)).toEqual([])
  })

  it('refuses to reach past query to the SDK', async () => {
    expect(await lintAt('packages/actions/src/billing.ts', IMPORTS.sdk)).toHaveLength(1)
  })

  it('refuses UI, because actions are headless', async () => {
    expect(await lintAt('packages/actions/src/billing.ts', IMPORTS.ui)).toHaveLength(1)
  })
})

describe('apps compose through the door', () => {
  it('may use UI, actions, query and domain together — that is what a page is', async () => {
    const code = [IMPORTS.ui, IMPORTS.actions, IMPORTS.query, IMPORTS.domain].join('\n')
    expect(await lintAt('apps/console/src/pages/Invoices.tsx', code)).toEqual([])
  })

  it.each([
    ['the SDK', IMPORTS.sdk],
    ['@fp/api', IMPORTS.api],
  ])('refuses %s, which would bypass retry, errors and auth', async (_label, code) => {
    expect(await lintAt('apps/console/src/pages/Invoices.tsx', code)).toHaveLength(1)
  })
})

describe('block-grade primitives live behind one seam', () => {
  it('lets the flexprice grids import the data grid', async () => {
    expect(await lintAt('packages/ui/src/flexprice/CouponGrid.tsx', IMPORTS.dataGrid)).toEqual([])
  })

  it('lets FilterBar import the filter builder', async () => {
    expect(await lintAt('packages/ui/src/compositions/FilterBar.tsx', IMPORTS.filters)).toEqual([])
  })

  it('refuses a composition reaching for the data grid directly', async () => {
    const messages = await lintAt('packages/ui/src/compositions/Toolbar.tsx', IMPORTS.dataGrid)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatch(/one place|FeatureGrid|block-grade/i)
  })

  // The whole reason the seam rule replicates the full forbidden set: a second
  // no-restricted-imports config replaces the first, so if it dropped the SDK
  // ban, a non-seam file could quietly import the SDK. It must not.
  it('still forbids the SDK in a non-seam composition — the seam rule does not clobber the UI rule', async () => {
    expect(await lintAt('packages/ui/src/compositions/Toolbar.tsx', IMPORTS.sdk)).toHaveLength(1)
  })
})

describe('the temporary adapter cannot spread', () => {
  it.each([
    'apps/console/src/pages/Invoices.tsx',
    'packages/ui/src/flexprice/Thing.tsx',
    'packages/actions/src/billing.ts',
  ])('refuses a shim import in %s', async (path) => {
    const messages = await lintAt(path, IMPORTS.adapter)
    expect(messages.length).toBeGreaterThanOrEqual(1)
    expect(messages.join(' ')).toMatch(/temporary|api-contract-gap/i)
  })
})
