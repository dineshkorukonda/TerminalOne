import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Renderer root element is missing')

createRoot(root).render(
  <StrictMode>
    <main>
      <p className="eyebrow">Desktop foundation</p>
      <h1>Terminal One</h1>
      <p>The application window is ready.</p>
      <p className="status">Shell sessions arrive in the next phase.</p>
    </main>
  </StrictMode>
)
