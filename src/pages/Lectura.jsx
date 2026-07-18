import { useState } from 'react'
import { supabase } from '../supabaseClient'

function limpiarPalabra(palabra) {
  return palabra.toLowerCase().replace(/[.,!?;:"']/g, '')
}

function Lectura() {
  const [lectura, setLectura] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [palabraSeleccionada, setPalabraSeleccionada] = useState(null)
  const [traduccion, setTraduccion] = useState(null)
  const [traduciendo, setTraduciendo] = useState(false)
  const [agregada, setAgregada] = useState(false)

  async function generarNuevaLectura() {
    setCargando(true)
    setLectura(null)
    setPalabraSeleccionada(null)
    setTraduccion(null)

    try {
      const perfil = await supabase.from('perfil_usuario').select('nivel_actual').eq('id', 1).single()
      const nivel = perfil.data?.nivel_actual || 'A1'

      const respuesta = await fetch('http://127.0.0.1:5000/generar-lectura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nivel }),
      })
      const datos = await respuesta.json()
      setLectura(datos.lectura)
    } catch (error) {
      console.error('Error generando lectura:', error)
    } finally {
      setCargando(false)
    }
  }

  async function clickearPalabra(palabraOriginal) {
    const palabra = limpiarPalabra(palabraOriginal)
    if (!palabra) return

    setPalabraSeleccionada(palabra)
    setTraduccion(null)
    setAgregada(false)
    setTraduciendo(true)

    try {
      const respuesta = await fetch('http://127.0.0.1:5000/traducir-palabra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ palabra }),
      })
      const datos = await respuesta.json()

      if (datos.error || !datos.palabra_en) {
        setTraduccion({ error: true })
      } else {
        setTraduccion(datos)
      }
    } catch (error) {
      console.error('Error traduciendo:', error)
      setTraduccion({ error: true })
    } finally {
      setTraduciendo(false)
    }
  }

  async function agregarAVocabulario() {
    if (!traduccion) return

    try {
      const existente = await supabase
        .from('vocabulario')
        .select('id')
        .ilike('palabra_en', traduccion.palabra_en)

      if (existente.data && existente.data.length > 0) {
        setAgregada(true)
        return
      }

      await supabase.from('vocabulario').insert({
        palabra_es: traduccion.palabra_es,
        palabra_en: traduccion.palabra_en,
        pronunciacion: traduccion.pronunciacion,
        proximo_repaso: new Date().toISOString().split('T')[0],
      })

      setAgregada(true)
    } catch (error) {
      console.error('Error agregando a vocabulario:', error)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-3xl font-black text-cyan-400 mb-2">Lectura</h1>
      <p className="text-gray-500 text-sm mb-6">
        Da clic en cualquier palabra que no conozcas para ver su traducción.
      </p>

      {!lectura && !cargando && (
        <button
          onClick={generarNuevaLectura}
          className="bg-cyan-400/10 text-cyan-400 font-bold px-4 py-2 rounded-lg hover:bg-cyan-400/20"
        >
          📖 Generar nueva lectura
        </button>
      )}

      {cargando && <p className="text-gray-400">Generando tu lectura...</p>}

      {lectura && (
        <div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-4">
            <h2 className="text-xl font-black text-gray-100 mb-3">{lectura.titulo}</h2>
            <p className="text-gray-300 leading-relaxed">
              {lectura.contenido.split(' ').map((palabra, i) => (
                <span
                  key={i}
                  onClick={() => clickearPalabra(palabra)}
                  className="cursor-pointer hover:bg-cyan-400/20 hover:text-cyan-300 rounded px-0.5 transition-colors"
                >
                  {palabra}{' '}
                </span>
              ))}
            </p>
          </div>

          <button
            onClick={generarNuevaLectura}
            className="text-sm bg-gray-800 text-cyan-400 px-3 py-1.5 rounded-lg hover:bg-gray-700"
          >
            🔄 Otra lectura
          </button>
        </div>
      )}

      {palabraSeleccionada && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 border border-cyan-400/30 rounded-xl p-4 shadow-lg w-80">
          {traduciendo ? (
            <p className="text-gray-400 text-sm">Traduciendo "{palabraSeleccionada}"...</p>
          ) : traduccion?.error ? (
            <div>
              <p className="text-red-400 text-sm mb-2">No pude traducir esa palabra, intenta de nuevo.</p>
              <button
                onClick={() => clickearPalabra(palabraSeleccionada)}
                className="text-sm bg-gray-800 text-cyan-400 px-3 py-1.5 rounded-lg hover:bg-gray-700"
              >
                Reintentar
              </button>
            </div>
          ) : traduccion ? (
            <div>
              <p className="text-cyan-400 font-black text-lg">{traduccion.palabra_en}</p>
              <p className="text-gray-300">{traduccion.palabra_es}</p>
              <p className="text-gray-500 text-sm mb-3">/{traduccion.pronunciacion}/</p>

              {agregada ? (
                <p className="text-cyan-400 text-sm">✅ Agregada a tu Vocabulario</p>
              ) : (
                <button
                  onClick={agregarAVocabulario}
                  className="w-full bg-cyan-400/10 text-cyan-400 font-bold py-2 rounded-lg hover:bg-cyan-400/20 text-sm"
                >
                  ➕ Agregar a Vocabulario
                </button>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

export default Lectura