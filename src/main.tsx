import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// o escritório 3D (o maior pedaço do app) começa a baixar já, junto com o login e as marcas, em vez de esperar o App pedir
void import('./tres/Escritorio3D')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
