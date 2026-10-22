import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ESLint } from 'eslint'
import tseslint from 'typescript-eslint'
import { designRules, LEGACY } from './design'

/** Lints a TSX snippet as if it lived at `filePath`; returns the rule ids hit. */
async function lintAt(filePath: string, code: string): Promise<string[]> {
  const eslint = new ESLint({
    cwd: '/repo',
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
          parser: tseslint.parser,
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
      },
      ...designRules,
    ] as never,
  })
  const [result] = await eslint.lintText(code, { filePath: `/repo/${filePath}` })
  return (result?.messages ?? []).map((m) => m.ruleId ?? m.message)
}

const PAGE = 'packages/ui/src/pages/refunds/RefundGrid.tsx'

describe('pages use kit controls', () => {
  it.each([
    ['a table', '<table><tbody /></table>'],
    ['a button', '<button onClick={go}>Go</button>'],
    ['an input', '<input value={v} />'],
    ['a select', '<select />'],
  ])('refuses %s', async (_label, jsx) => {
    expect(await lintAt(PAGE, `export const X = () => ${jsx}`)).toContain(
      'design/no-hand-built-controls',
    )
  })

  it('allows the kit Button', async () => {
    expect(await lintAt(PAGE, 'export const X = () => <Button onClick={go}>Go</Button>')).toEqual(
      [],
    )
  })

  it('leaves pages/shared alone: that is the kit', async () => {
    expect(
      await lintAt('packages/ui/src/pages/shared/cells.tsx', 'export const X = () => <button />'),
    ).toEqual([])
  })
})

describe('colour comes from tokens', () => {
  it.each([
    ['a hex literal', "const c = '#ff0000'"],
    ['an arbitrary colour class', 'const c = "bg-[#0f2a3d] p-2"'],
    ['an oklch value', "const c = 'oklch(0.5 0.1 200)'"],
    ['an rgb value in a template', 'const c = `rgb(${r}, 0, 0)`'],
  ])('refuses %s', async (_label, code) => {
    expect(await lintAt(PAGE, code)).toContain('design/no-literal-colour')
  })

  it('allows token classes', async () => {
    expect(await lintAt(PAGE, "const c = 'text-muted-foreground bg-muted border'")).toEqual([])
  })

  it('lets a chart file encode a series colour', async () => {
    expect(
      await lintAt('packages/ui/src/pages/shared/charts.tsx', "const c = 'oklch(0.5 0.1 200)'"),
    ).toEqual([])
  })
})

describe('no stylesheets', () => {
  it('refuses importing a css file into a page or composition', async () => {
    expect(await lintAt(PAGE, "import './refunds.css'")).toContain('design/no-stylesheets')
    expect(
      await lintAt('packages/ui/src/compositions/layout/X.tsx', "import './x.module.css'"),
    ).toContain('design/no-stylesheets')
  })
})

describe('every menu item has an icon', () => {
  it('refuses a row action without one', async () => {
    const code = "const a = [{ label: 'Refund', onSelect: () => refund() }]"
    expect(await lintAt(PAGE, code)).toContain('design/menu-item-icon')
  })

  it('accepts a row action with one', async () => {
    const code = "const a = [{ label: 'Refund', icon: <UndoIcon aria-hidden />, onSelect: go }]"
    expect(await lintAt(PAGE, code)).toEqual([])
  })
})

describe('section actions are secondary', () => {
  it('refuses a filled button in a Section header', async () => {
    const code =
      'export const X = () => <Section title="Notes" action={<Button onClick={add}>Add note</Button>}>x</Section>'
    expect(await lintAt(PAGE, code)).toContain('design/section-action-variant')
  })

  it('refuses an explicit variant="default" there too', async () => {
    const code =
      'export const X = () => <Section title="Notes" actions={<Button variant="default">Add</Button>}>x</Section>'
    expect(await lintAt(PAGE, code)).toContain('design/section-action-variant')
  })

  it('accepts an outline button', async () => {
    const code =
      'export const X = () => <Section title="Notes" action={<Button variant="outline">Add note</Button>}>x</Section>'
    expect(await lintAt(PAGE, code)).toEqual([])
  })

  it('leaves the empty state and page header create action filled', async () => {
    const code =
      'export const X = () => <><PageHeader title="Refunds" action={<Button>New refund</Button>} /><SectionEmpty title="None" action={<Button>Add</Button>} /></>'
    expect(await lintAt(PAGE, code)).toEqual([])
  })
})

describe('the legacy lists', () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url))
  it.each(Object.entries(LEGACY))('%s names only files that still exist', (_rule, files) => {
    for (const file of files) expect(existsSync(root + file), file).toBe(true)
  })
})
