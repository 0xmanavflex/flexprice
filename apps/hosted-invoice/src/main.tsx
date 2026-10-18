import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from '@fp/query'
import { ThemeProvider } from '@fp/ui/compositions'
import './styles.css'
import { App } from './App'

const container = document.getElementById('root')
if (!container) throw new Error('#root is missing from index.html')

const queryClient = createQueryClient()

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <App pathname={window.location.pathname} />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
