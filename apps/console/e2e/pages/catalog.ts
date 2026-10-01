import type { Locator, Page } from '@playwright/test'

/**
 * A catalogue list surface — a plans, coupons or add-ons list.
 *
 * They share one skeleton (`PageHeader` + a `DataGrid` behind a `GridToolbar`),
 * so one object serves all of them: the heading names the surface, the search
 * field is labelled per surface, and the grid is a real `<table>` whose rows
 * are the records. What differs between surfaces is only those two names, so
 * they are the constructor's arguments rather than three near-identical files.
 */
export class CatalogListPage {
  readonly heading: Locator
  readonly search: Locator
  readonly grid: Locator

  private readonly page: Page

  constructor(page: Page, options: { heading: string; searchLabel: string }) {
    this.page = page
    // `PageHeader` renders the title as the page's one `<h1>`.
    this.heading = page.getByRole('heading', { level: 1, name: options.heading })
    // `GridToolbar` labels its input; the default view is the table, so the
    // field is a plain textbox (no `type=search`), named by that label.
    this.search = page.getByRole('textbox', { name: options.searchLabel })
    this.grid = page.getByRole('table')
  }

  /** The data rows — every `row` except the header. */
  rows(): Locator {
    // `<thead>`'s row is a `row` too, so it is excluded by position, not by a
    // brittle guess at how many columns or what text a data row holds.
    return this.grid.getByRole('row').filter({ has: this.page.getByRole('cell') })
  }

  /** Open the first record, whatever it happens to be under the fixtures. */
  async openFirstRow() {
    // The whole row is clickable (`onRowClick`), but the select and name cells
    // are interactive (checkbox, inline rename); the third cell is plain text.
    await this.rows().first().getByRole('cell').nth(2).click()
  }
}

/**
 * A coupon's detail page.
 *
 * The surface a row opens, and the one that carries the V2 promise V1 could not
 * keep: **Where used** — the subscriptions the coupon is applied to. That
 * section is a titled region (`Section`), so it is addressable by its heading.
 */
export class CouponDetailPage {
  /** The Overview's `Section title="Terms"`, an `<h2>` region heading. */
  readonly terms: Locator
  /** The way back to the list, so a detail page is not a dead end. */
  readonly back: Locator

  private readonly page: Page

  constructor(page: Page) {
    this.page = page
    this.terms = page.getByRole('heading', { name: 'Terms' })
    this.back = page.getByRole('button', { name: 'Coupons' })
  }
}
