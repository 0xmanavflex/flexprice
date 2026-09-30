import { expect, type Locator, type Page } from '@playwright/test'

/**
 * A plan's detail page and the contextual forms opened from its tabs.
 *
 * Sections are a `<nav aria-label="Plan sections">` of links-as-buttons; every
 * create/edit opens in place, as a section named by its title (no dialog), and
 * a row's edit lives in its "Actions for <name>" menu.
 */
export class PlanDetailPage {
  readonly nav: Locator
  readonly main: Locator

  private readonly page: Page

  constructor(page: Page) {
    this.page = page
    this.nav = page.getByRole('navigation', { name: 'Plan sections' })
    this.main = page.getByRole('main')
  }

  async open() {
    await this.page.goto('/plans/plan_synth_0000')
    await expect(this.nav).toBeVisible({ timeout: 20_000 })
  }

  async section(name: string) {
    await this.nav.getByRole('button', { name }).click()
  }

  rowMenu(): Locator {
    return this.page.getByRole('button', { name: /^Actions for / })
  }

  async chooseRowAction(row: number, action: string) {
    await this.rowMenu().nth(row).click()
    await this.page.getByRole('menuitem', { name: action }).click()
  }
}
