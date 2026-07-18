import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { URL_SERVIDOR } from './config'

function Navbar() {
  const [uso, setUso] = useState(null)

  const links = [
    { to: '/', label: 'Vocabulario' },
    { to: '/gramatica', label: 'Gramática' },
    { to: '/conversacion', label: 'Conversación' },
    { to: '/pronunciacion', label: 'Pronunciación' },
    { to: '/lectura', label: 'Lectura' },
    { to: '/progreso', label: 'Progreso' },
  ]

  useEffect(() => {
    cargarUso()
    const intervalo = setInterval(cargarUso, 30000) // se actualiza cada 30 segundos
    return () => clearInterval(intervalo)
  }, [])

  async function cargarUso() {
    console.log('URL_SERVIDOR es:', URL_SERVIDOR)
    try {
      const respuesta = await fetch(`${URL_SERVIDOR}/uso-api`)
      const datos = await respuesta.json()
      setUso(datos)
    } catch (error) {
      console.error('Error obteniendo uso de API:', error)
    }
  }

  function colorBarra(porcentaje) {
    if (porcentaje < 60) return 'bg-cyan-400'
    if (porcentaje < 85) return 'bg-yellow-400'
    return 'bg-red-500'
  }

  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
      <div className="flex gap-2 flex-wrap">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                isActive
                  ? 'bg-cyan-400/10 text-cyan-400'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </div>

      {uso && (
        <div className="flex items-center gap-2 text-xs text-gray-500" title="Uso estimado de IA hoy">
          <span>IA hoy: {uso.llamadas_hoy}/{uso.limite_estimado}</span>
          <div className="w-20 bg-gray-800 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${colorBarra(uso.porcentaje)}`}
              style={{ width: `${Math.min(uso.porcentaje, 100)}%` }}
            />
          </div>
        </div>
      )}
    </nav>
  )
}

export default Navbar