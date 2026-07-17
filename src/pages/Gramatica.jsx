import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

function Gramatica() {
  const [preguntas, setPreguntas] = useState([])
  const [indice, setIndice] = useState(0)
  const [seleccion, setSeleccion] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [aciertos, setAciertos] = useState(0)

  useEffect(() => {
    cargarPreguntas()
  }, [])

  async function cargarPreguntas() {
    setCargando(true)
    const { data, error } = await supabase
      .from('gramatica')
      .select('*')
      .order('id', { ascending: true })

    if (error) {
      console.error('Error cargando preguntas:', error)
    } else {
      setPreguntas(data)
    }
    setCargando(false)
  }

  function elegirOpcion(opcion) {
    if (seleccion) return // ya eligió, no dejar cambiar
    setSeleccion(opcion)
    if (opcion === preguntas[indice].respuesta_correcta) {
      setAciertos((a) => a + 1)
    }
  }

  function siguiente() {
    setSeleccion(null)
    setIndice((i) => i + 1)
  }

  if (cargando) {
    return <div className="p-6 text-gray-400">Cargando preguntas...</div>
  }

  if (preguntas.length === 0) {
    return <div className="p-6 text-gray-400">No hay preguntas todavía.</div>
  }

  if (indice >= preguntas.length) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-black text-cyan-400 mb-4">¡Terminaste!</h1>
        <p className="text-gray-300 text-lg">
          Acertaste {aciertos} de {preguntas.length} preguntas.
        </p>
        <button
          onClick={() => {
            setIndice(0)
            setAciertos(0)
            setSeleccion(null)
          }}
          className="mt-4 bg-cyan-400/10 text-cyan-400 font-bold px-4 py-2 rounded-lg hover:bg-cyan-400/20"
        >
          Repetir examen
        </button>
      </div>
    )
  }

  const p = preguntas[indice]
  const opciones = [p.opcion_a, p.opcion_b, p.opcion_c]

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-3xl font-black text-cyan-400 mb-2">Gramática</h1>
      <p className="text-gray-500 text-sm mb-4">
        Pregunta {indice + 1} de {preguntas.length}
      </p>

      <p className="text-xl text-gray-100 mb-4">{p.pregunta}</p>

      <div className="flex flex-col gap-2">
        {opciones.map((opcion) => {
          let estilo = 'bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-800'
          if (seleccion) {
            if (opcion === p.respuesta_correcta) {
              estilo = 'bg-cyan-400/10 border-cyan-400/50 text-cyan-400'
            } else if (opcion === seleccion) {
              estilo = 'bg-red-500/10 border-red-500/50 text-red-400'
            }
          }
          return (
            <button
              key={opcion}
              onClick={() => elegirOpcion(opcion)}
              className={`text-left border rounded-lg px-4 py-3 transition-colors ${estilo}`}
            >
              {opcion}
            </button>
          )
        })}
      </div>

      {seleccion && (
        <div className="mt-4 bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-gray-300 text-sm">{p.explicacion}</p>
          <button
            onClick={siguiente}
            className="mt-3 bg-cyan-400/10 text-cyan-400 font-bold px-4 py-2 rounded-lg hover:bg-cyan-400/20"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}

export default Gramatica