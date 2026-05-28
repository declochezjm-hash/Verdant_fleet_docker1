import { createRoot } from 'react-dom/client'
import { StartClient } from '@tanstack/react-start'
import { createRouter } from './router'

const router = createRouter()

const root = document.getElementById('root')
if (!root) throw new Error('No root element found')

createRoot(root).render(
  <StartClient router={router} />
)