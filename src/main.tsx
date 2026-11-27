import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/styles/base.css'
import './ui/styles/screens.css'
import App from './App'
import { applyUrlOverrides } from './game/settings'
import './game/qa'

applyUrlOverrides()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
