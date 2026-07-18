import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { URL_SERVIDOR } from '../config'

const MAX_POR_SESION = 10

function barajar(arreglo) {
  const copia = [...arreglo]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}

function Pronunciacion() {
  const [todasLasPalabras, setTodasLasPalabras] = useState([])
  const [cola, setCola] = useState([])
  const [indice, setIndice] = useState(0)
  const [opciones, setOpciones] = useState([])
  const [seleccion, setSeleccion] = useState(null)
  const [aciertos, setAciertos] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [generandoRepaso, setGenerandoRepaso] = useState(false)
  const [mensajeRepaso, setMensajeRepaso] = useState('')

  useEffect(() => {
    cargarSesion()
  }, [])

  useEffect(() => {
    if (cola.length > 0 && indice < cola.length) {
      armarPregunta()
    }
    // eslint-disable-next-line
  }, [indice, cola])

  async function cargarTodas() {
    const { data, error } = await supabase.from('pronunciacion').select('*')
    if (error) {
      console.error('Error cargando palabras:', error)
      return []
    }
    setTodasLasPalabras(data)
    return data
  }

  async function cargarSesion() {
    setCargando(true)
    const hoy = new Date().toISOString().split('T')[0]
    const todas = await cargarTodas()

    const { data, error } = await supabase
      .from('pronunciacion')
      .select('*')
      .lte('proximo_repaso', hoy)
      .order('proximo_repaso', { ascending: true })
      .limit(MAX_POR_SESION)

    if (!error) setCola(data)
    if (todas.length === 0) setTodasLasPalabras(await cargarTodas())
    setIndice(0)
    setAciertos(0)
    setCargando(false)
  }

  async function cargarSesionLibre() {
    setCargando(true)
    const { data, error } = await supabase
      .from('pronunciacion')
      .select('*')
      .order('proximo_repaso', { ascending: true })
      .limit(MAX_POR_SESION)

    if (!error) setCola(data)
    setIndice(0)
    setAciertos(0)
    setCargando(false)
  }

  async function generarRepasoDeErrores() {
    setGenerandoRepaso(true)
    setMensajeRepaso('')
    try {
      const respuesta = await fetch(`${URL_SERVIDOR}/generar-repaso`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tema: 'pronunciacion' }),
      })
      const datos = await respuesta.json()

      if (datos.generadas > 0) {
        setMensajeRepaso(`✅ Se generaron ${datos.generadas} palabras nuevas de tus errores reales.`)
        await cargarSesion()
      } else {
        setMensajeRepaso('No tienes errores nuevos pendientes de repasar.')
      }
    } catch (error) {
      console.error('Error generando repaso:', error)
      setMensajeRepaso('⚠️ No se pudo conectar con el servidor de Python.')
    } finally {
      setGenerandoRepaso(false)
    }
  }

  function armarPregunta() {
    const actual = cola[indice]
    const otras = todasLasPalabras.filter((p) => p.id !== actual.id)
    const distractores = barajar(otras).slice(0, 2)
    setOpciones(barajar([actual, ...distractores]))
    setSeleccion(null)
  }

  async function escucharActual() {
    const p = cola[indice]
    try {
      const respuesta = await fetch(`${URL_SERVIDOR}/pronunciar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ palabra: p.palabra_en }),
      })
      if (!respuesta.ok) return
      const audioBlob = await respuesta.blob()
      const audio = new Audio(URL.createObjectURL(audioBlob))
      audio.play()
    } catch (error) {
      console.error('Error con el servidor de Python:', error)
    }
  }

  async function elegir(opcion) {
    if (seleccion) return
    setSeleccion(opcion)

    const actual = cola[indice]
    const acerto = opcion.id === actual.id

    let nuevoIntervalo
    let camposActualizar = {}

    if (acerto) {
      nuevoIntervalo = Math.min((actual.intervalo_dias || 1) * 2, 60)
      camposActualizar.veces_correcta = (actual.veces_correcta || 0) + 1
      setAciertos((a) => a + 1)
    } else {
      nuevoIntervalo = 1
      camposActualizar.veces_incorrecta = (actual.veces_incorrecta || 0) + 1
    }

    const proxima = new Date()
    proxima.setDate(proxima.getDate() + nuevoIntervalo)
    camposActualizar.intervalo_dias = nuevoIntervalo
    camposActualizar.proximo_repaso = proxima.toISOString().split('T')[0]

    await supabase.from('pronunciacion').update(camposActualizar).eq('id', actual.id)
  }

  function siguiente() {
    setIndice((i) => i + 1)
  }

  if (cargando) {
    return <div className="p-6 text-gray-400">Preparando tu repaso de hoy...</div>
  }

  const encabezado = (
    <div className="flex items-center justify-between mb-2">
      <h1 className="text-3xl font-black text-cyan-400">Pronunciación</h1>
      <button
        onClick={generarRepasoDeErrores}
        disabled={generandoRepaso}
        className="text-xs bg-gray-800 text-cyan-400 px-3 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-50"
      >
        {generandoRepaso ? 'Generando...' : '🎯 Repasar mis errores'}
      </button>
    </div>
  )

  if (cola.length === 0) {
    return (
      <div className="p-6">
        {encabezado}
        {mensajeRepaso && <p className="text-sm text-gray-400 mb-3">{mensajeRepaso}</p>}
        <p className="text-gray-400 mb-4">🎉 No tienes palabras pendientes de repaso hoy.</p>
        <button
          onClick={cargarSesionLibre}
          className="bg-gray-800 text-cyan-400 font-bold px-4 py-2 rounded-lg hover:bg-gray-700"
        >
          Practicar de todos modos
        </button>
      </div>
    )
  }

  if (indice >= cola.length) {
    return (
      <div className="p-6">
        {encabezado}
        <h2 className="text-2xl font-black text-gray-100 mb-2">¡Terminaste! 🎧</h2>
        <p className="text-gray-300 text-lg">
          Acertaste {aciertos} de {cola.length} palabras por oído.
        </p>
        <button
          onClick={cargarSesion}
          className="mt-4 bg-cyan-400/10 text-cyan-400 font-bold px-4 py-2 rounded-lg hover:bg-cyan-400/20"
        >
          Repetir sesión
        </button>
      </div>
    )
  }

  const actual = cola[indice]

  return (
    <div className="p-6 max-w-xl">
      {encabezado}
      {mensajeRepaso && <p className="text-sm text-gray-400 mb-3">{mensajeRepaso}</p>}
      <p className="text-gray-500 text-sm mb-6">
        Palabra {indice + 1} de {cola.length} — escucha y adivina
      </p>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 flex flex-col items-center gap-4 mb-4">
        <button onClick={escucharActual} className="text-6xl hover:scale-110 transition-transform" title="Escuchar">
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
            <span className="text-cyan-400 font-bold">{actual.palabra_en}</span> ({actual.palabra_es}) se pronuncia{' '}
            <span className="text-cyan-400">/{actual.pronunciacion}/</span>
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