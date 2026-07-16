import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

function Vocabulario() {
  const [palabras, setPalabras] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargarPalabras()
  }, [])

  async function cargarPalabras() {
    setCargando(true)
    const { data, error } = await supabase
      .from('vocabulario')
      .select('*')
      .order('id', { ascending: true })

    if (error) {
      console.error('Error cargando palabras:', error)
    } else {
      setPalabras(data)
    }
    setCargando(false)
  }

  async function marcarAprendida(id, valorActual) {
    const { error } = await supabase
      .from('vocabulario')
      .update({ aprendida: !valorActual })
      .eq('id', id)

    if (error) {
      console.error('Error actualizando:', error)
    } else {
      cargarPalabras()
    }
  }

  if (cargando) {
    return <div className="p-6 text-gray-400">Cargando palabras...</div>
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-black text-cyan-400 mb-6">Vocabulario</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {palabras.map((p) => (
          <div
            key={p.id}
            className={`rounded-xl border p-4 transition-colors ${
              p.aprendida
                ? 'bg-cyan-400/10 border-cyan-400/50'
                : 'bg-gray-900 border-gray-800'
            }`}
          >
            <p className="text-gray-400 text-sm">{p.palabra_es}</p>
            <p className="text-2xl font-black text-gray-100">{p.palabra_en}</p>
            <p className="text-cyan-400 text-sm mt-1">/{p.pronunciacion}/</p>

            <button
              onClick={() => marcarAprendida(p.id, p.aprendida)}
              className={`mt-3 w-full text-xs font-bold py-2 rounded-lg transition-colors ${
                p.aprendida
                  ? 'bg-cyan-400/20 text-cyan-400 hover:bg-cyan-400/30'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {p.aprendida ? '✓ Aprendida' : 'Marcar como aprendida'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Vocabulario