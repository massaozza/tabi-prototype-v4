import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n/index'  // i18n初期化（App前にimport必須）
import App from './App.tsx'
import { initAnalytics } from './lib/analytics'

// GA4を初期化（測定IDが未設定なら何もしない）
initAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
