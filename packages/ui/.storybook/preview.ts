import type { Preview } from '@storybook/react-vite'
import '../src/styles.css'
import './preview.css'

// Under an automated browser (the story test run) switch motion off. Dialogs,
// popovers and menus fade in; on a slow CI runner `toBeVisible` and axe would
// catch them half-way and fail a story that is correct. People opening the
// workbench keep the real animations.
if (typeof navigator !== 'undefined' && navigator.webdriver) {
  const style = document.createElement('style')
  style.textContent =
    '*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; scroll-behavior: auto !important; }'
  document.head.append(style)
}

const preview: Preview = {
  // Every story also generates a docs page from its props and TSDoc, so the
  // workbench documents the component library, not only exercises it.
  tags: ['autodocs'],
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/ } },
    a11y: {
      // Fail the test run, rather than leaving a panel for somebody to read.
      // A data grid is exactly the component where an accessibility regression
      // hides behind a visually convincing implementation.
      test: 'error',
    },
    // The design system leads, then the foundations it is built from, then the
    // product surfaces. Without an explicit order the sidebar is alphabetical
    // and the introduction lands in the middle of the list.
    options: {
      storySort: {
        order: [
          'Design System',
          ['Introduction', 'Page map', 'Colors', 'Typography', 'Radius', 'Elevation'],
          // Whole pages first — the place to start when asking "what is on this
          // screen", before dropping into the parts they are made of.
          'Pages',
          'Surfaces',
          'Foundation',
        ],
      },
    },
  },
  // Light and dark are both first-class, so any story can be read in either
  // from the toolbar. The app switches themes with a class on <html>; match
  // that here rather than inventing a second mechanism the components would not
  // see.
  globalTypes: {
    theme: {
      description: 'Colour scheme',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      document.documentElement.classList.toggle('dark', context.globals['theme'] === 'dark')
      return Story()
    },
  ],
}

export default preview
