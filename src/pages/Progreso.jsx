import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORES = ['#22d3ee', '#374151'] // cyan para aprendidas, gris para pendientes

function Progreso() {
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargarProgreso()
  }, [])

  async function cargarProgreso() {
    setCargando(true)
    const { data, error } = await supabase.from('vocabulario').select('aprendida')

    if (error) {
      console.error('Error cargando progreso:', error)
      setCargando(false)
      return
    }

    const aprendidas = data.filter((p) => p.aprendida).length
    const pendientes = data.length - aprendidas

    setDatos({
      total: data.length,
      aprendidas,
      pendientes,
      grafica: [
        { name: 'Aprendidas', value: aprendidas },
        { name: 'Pendientes', value: pendientes },
      ],
    })
    setCargando(false)
  }

  if (cargando) {
    return <div className="p-6 text-gray-400">Cargando progreso...</div>
  }

  if (!datos || datos.total === 0) {
    return <div className="p-6 text-gray-400">Todavía no hay vocabulario registrado.</div>
  }

  const porcentaje = Math.round((datos.aprendidas / datos.total) * 100)

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-3xl font-black text-cyan-400 mb-2">Progreso</h1>
      <p className="text-gray-400 mb-6">
        Llevas {datos.aprendidas} de {datos.total} palabras aprendidas ({porcentaje}%)
      </p>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4" style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={datos.grafica}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={4}
            >
              {datos.grafica.map((_, index) => (
                <Cell key={index} fill={COLORES[index]} stroke="none" />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default Progreso