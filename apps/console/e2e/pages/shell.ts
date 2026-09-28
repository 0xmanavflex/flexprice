import { expect, type Locator, type Page } from '@playwright/test'

/**
 * The application shell — the sidebar and the surfaces it reaches.
 *
 * A page object because every journey moves through the shell, and how the nav
 * is addressed should be one edit rather than one per spec.
 *
 * On scoping. Watchtower selects its nav with `getByRole('navigation', …)`,
 * because there the primary nav is a `<nav>` landmark. The console's shell is a
 * ReUI `sidebar` composition: the primary nav is a *labelled `<div>`*
 * (`aria-label="Main"`), not a `<nav>`, and its entries are `<button>`s that
 * call a navigate callback rather than `<a>`s. There is no navigation landmark
 * to select by role, so we scope by the accessible label the shell does expose,
 * and the entries are located by their button role and accessible name. If a
 * landmark is added later, `nav` is the one line to change.
 */
export class ShellPage {
  /** The primary sidebar, by its accessible label — the scope for every entry. */
  readonly nav: Locator
  /**
   * A stable, un-counted, top-level entry. Its survival after a navigation is
   * how we assert the shell wrapped the surface rather than being replaced by
   * it — the console's analogue of Watchtower's "Overview stays visible".
   */
  readonly home: Locator

  // Assigned in the body rather than as constructor parameter properties:
  // parameter properties are not erasable syntax, and the design system's page
  // objects (Watchtower's `designSystem.ts`) hold to the same rule.
  private readonly page: Page

  constructor(page: Page) {
    this.page = page
    this.nav = page.locator('[aria-label="Main"]')
    this.home = this.item('Home')
  }

  async goto(path = '/') {
    await this.page.goto(path)
  }

  /**
   * A nav entry, by its accessible name.
   *
   * Not `exact`: an entry in the open group carries its count in the accessible
   * name (the number sits outside the button, so "Plans, 12" is assembled onto
   * `aria-label` or the row is read as a loose figure). A substring match keeps
   * the object honest about a count it does not control and should not assert.
   */
  item(name: string): Locator {
    return this.nav.getByRole('button', { name })
  }

  /** Click a nav entry. A parent routes to its first child; a leaf to itself. */
  async go(name: string) {
    await this.item(name).click()
  }

  /**
   * The environment switcher, which lives in the breadcrumb rather than the
   * sidebar. Its accessible name carries the current environment, so it is
   * matched on the invariant tail — the name and kind are the thing under test.
   */
  get environment(): Locator {
    return this.page.getByRole('button', { name: /Change environment/ })
  }

  /** What the switcher currently reads, with no assumption about which it is. */
  async currentEnvironment(): Promise<string> {
    return ((await this.environment.textContent()) ?? '').trim()
  }

  /**
   * Switch to a named environment and wait for the switch to take.
   *
   * Which environment a console opens in is a per-tenant accident — V1 and V2
   * both take the first the API returns — so any test that asserts on *data*
   * has to say which environment it means rather than hope the default is the
   * one holding rows.
   */
  async switchEnvironment(name: string) {
    await this.environment.click()
    const option = this.page
      .getByRole('menuitem', { name })
      .or(this.page.getByRole('option', { name }))
      .first()
    await option.click()
    await expect(this.environment).toContainText(name)
  }
}
