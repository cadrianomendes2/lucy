import React from 'react'
import ReactDOM from 'react-dom/client'
import * as THREE from 'three'
import App from './App.jsx'
import './index.css'

// Expõe Three.js como global antes de qualquer render.
// O react-force-graph inclui aframe-extras que tenta fazer `THREE.ColladaLoader = ...`
// em tempo de inicialização do módulo. ES Module exports são read-only, por isso
// usamos spread para criar um objecto mutável com todas as classes Three.js.
window.THREE = { ...THREE }

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
