// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { isModalOpen } from './useModalOpen'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('isModalOpen', () => {
  it('is false with no dialog open', () => {
    document.body.innerHTML = '<div role="region"></div>'
    expect(isModalOpen()).toBe(false)
  })

  it('is true while a dialog, sheet or alert dialog is open', () => {
    document.body.innerHTML = '<div role="dialog"></div>'
    expect(isModalOpen()).toBe(true)
    document.body.innerHTML = '<div role="alertdialog"></div>'
    expect(isModalOpen()).toBe(true)
  })

  it("ignores the support chat's own window", () => {
    document.body.innerHTML =
      '<div class="PylonChat-chatWindowFrameContainer"><div role="dialog"></div></div>'
    expect(isModalOpen()).toBe(false)
  })
})
