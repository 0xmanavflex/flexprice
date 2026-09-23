import type { Preview } from '@storybook/react-vite'
import '../src/styles.css'

const preview: Preview = {
  parameters: {
    controls: { matchers: { date: /Date$/ } },
    a11y: {
      // Fail the test run, rather than leaving a panel for somebody to read.
      // A data grid is exactly the component where an accessibility regression
      // hides behind a visually convincing implementation.
      test: 'error',
    },
  },
}

export default preview
