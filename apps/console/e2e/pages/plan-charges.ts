import { expect, type Locator, type Page } from '@playwright/test'

/**
 * A plan's detail page and the contextual forms opened from its tabs.
 *
 * Sections are tabs; every create/edit opens in a dialog (`main` here is that
 * dialog), and a row's edit lives in its "Actions for <name>" menu.
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

  async section(name: string) {
    await this.page.getByRole('tab', { name }).click()
  }

  rowMenu(): Locator {
    return this.page.getByRole('button', { name: /^Actions for / })
  }

  async chooseRowAction(row: number, action: string) {
    await this.rowMenu().nth(row).click()
    await this.page.getByRole('menuitem', { name: action }).click()
  }
}
