import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

function barajar(arreglo) {
  const copia = [...arreglo]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}

function Pronunciacion() {
  const [palabras, setPalabras] = useState([])
  const [orden, setOrden] = useState([])
  const [indice, setIndice] = useState(0)
  const [opciones, setOpciones] = useState([])
  const [seleccion, setSeleccion] = useState(null)
  const [aciertos, setAciertos] = useState(0)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargarPalabras()
  }, [])

  useEffect(() => {
    if (palabras.length > 0 && orden.length > 0 && indice < orden.length) {
      armarPregunta()
    }
    // eslint-disable-next-line
  }, [indice, palabras])

  async function cargarPalabras() {
    setCargando(true)
    const { data, error } = await supabase.from('pronunciacion').select('*')

    if (error) {
      console.error('Error cargando palabras:', error)
    } else {
      setPalabras(data)
      setOrden(barajar(data.map((_, i) => i)))
    }
    setCargando(false)
  }

  function armarPregunta() {
    const posicionReal = orden[indice]
    const actual = palabras[posicionReal]

    const otras = palabras.filter((p) => p.id !== actual.id)
    const distractores = barajar(otras).slice(0, 2)

    const opcionesGeneradas = barajar([actual, ...distractores])
    setOpciones(opcionesGeneradas)
    setSeleccion(null)
  }

  function palabraActual() {
    return palabras[orden[indice]]
  }

  async function escucharActual() {
    const p = palabraActual()
    try {
      const respuesta = await fetch('http://127.0.0.1:5000/pronunciar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ palabra: p.palabra_en }),
      })
      if (!respuesta.ok) return
      const audioBlob = await respuesta.blob()
      const audio = new Audio(URL.createObjectURL(audioBlob))
      audio.play()
    } catch (error) {
      console.error('Error conectando con el servidor de Python:', error)
    }
  }

  function elegir(opcion) {
    if (seleccion) return
    setSeleccion(opcion)
    if (opcion.id === palabraActual().id) {
      setAciertos((a) => a + 1)
    }
  }

  function siguiente() {
    setIndice((i) => i + 1)
  }

  function reiniciar() {
    setOrden(barajar(palabras.map((_, i) => i)))
    setIndice(0)
    setAciertos(0)
    setSeleccion(null)
  }

  if (cargando) {
    return <div className="p-6 text-gray-400">Cargando...</div>
  }

  if (palabras.length === 0) {
    return <div className="p-6 text-gray-400">No hay palabras todavía.</div>
  }

  if (indice >= orden.length) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-black text-cyan-400 mb-4">¡Terminaste! 🎧</h1>
        <p className="text-gray-300 text-lg">
          Acertaste {aciertos} de {orden.length} palabras por oído.
        </p>
        <button
          onClick={reiniciar}
          className="mt-4 bg-cyan-400/10 text-cyan-400 font-bold px-4 py-2 rounded-lg hover:bg-cyan-400/20"
        >
          Jugar de nuevo
        </button>
      </div>
    )
  }

  const actual = palabraActual()

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-3xl font-black text-cyan-400 mb-2">Pronunciación</h1>
      <p className="text-gray-500 text-sm mb-6">
        Palabra {indice + 1} de {orden.length} — escucha y adivina
      </p>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 flex flex-col items-center gap-4 mb-4">
        <button
          onClick={escucharActual}
          className="text-6xl hover:scale-110 transition-transform"
          title="Escuchar"
        >
          🔊
        </button>
        <p className="text-gray-500 text-sm">Dale clic para escuchar la palabra</p>
      </div>

      <div className="flex flex-col gap-2">
        {opciones.map((opcion) => {
          let estilo = 'bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-800'
          if (seleccion) {
            if (opcion.id === actual.id) {
              estilo = 'bg-cyan-400/10 border-cyan-400/50 text-cyan-400'
            } else if (opcion.id === seleccion.id) {
              estilo = 'bg-red-500/10 border-red-500/50 text-red-400'
            }
          }
          return (
            <button
              key={opcion.id}
              onClick={() => elegir(opcion)}
              className={`text-left border rounded-lg px-4 py-3 transition-colors ${estilo}`}
            >
              {opcion.palabra_en}
            </button>
          )
        })}
      </div>

      {seleccion && (
        <div className="mt-4 bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-gray-300 text-sm">
            <span className="text-cyan-400 font-bold">{actual.palabra_en}</span>{' '}
            ({actual.palabra_es}) se pronuncia <span className="text-cyan-400">/{actual.pronunciacion}/</span>
          </p>
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

export default Pronunciacion