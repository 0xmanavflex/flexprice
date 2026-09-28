import type { Locator, Page } from '@playwright/test'

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
}
