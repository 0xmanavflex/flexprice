import { expect, type Locator, type Page } from '@playwright/test'

/**
 * A plan's detail page and the contextual forms opened from it.
 *
 * Charges, entitlements and credit grants all live on Overview, stacked, so
 * `section` scopes to one of them rather than clicking a tab. Every
 * create/edit opens in a dialog (`main` here is that dialog), and a row's
 * edit lives in its "Actions for <name>" menu.
 */
export class PlanDetailPage {
  readonly nav: Locator
  readonly main: Locator

  private readonly page: Page

  constructor(page: Page) {
    this.page = page
    this.nav = page.getByRole('tablist')
    // Add and edit open in a dialog, which portals outside <main>.
    this.main = page.getByRole('dialog')
  }

  async open() {
    await this.page.goto('/plans/plan_synth_0000')
    await expect(this.nav).toBeVisible({ timeout: 20_000 })
  }

  /** The section being driven; every locator below is scoped to it. */
  private region: Locator | null = null

  async section(name: string) {
    const region = this.page.getByRole('region', { name: `${name} table` })
    await expect(region).toBeVisible({ timeout: 20_000 })
    await region.scrollIntoViewIfNeeded()
    this.region = region
  }

  /** The chosen section, or the whole page before one is chosen. */
  private get scope(): Locator | Page {
    return this.region ?? this.page
  }

  rowMenu(): Locator {
    return this.scope.getByRole('button', { name: /^Actions for / })
  }

  async chooseRowAction(row: number, action: string) {
    await this.rowMenu().nth(row).click()
    await this.page.getByRole('menuitem', { name: action }).click()
  }
}
