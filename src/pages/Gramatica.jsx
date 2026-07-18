import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { URL_SERVIDOR } from '../config'

const MAX_POR_SESION = 10

function Gramatica() {
  const [cola, setCola] = useState([])
  const [indice, setIndice] = useState(0)
  const [seleccion, setSeleccion] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [aciertos, setAciertos] = useState(0)
  const [generandoRepaso, setGenerandoRepaso] = useState(false)
  const [mensajeRepaso, setMensajeRepaso] = useState('')

  useEffect(() => {
    cargarSesion()
  }, [])

  async function cargarSesion() {
    setCargando(true)
    const hoy = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('gramatica')
      .select('*')
      .lte('proximo_repaso', hoy)
      .order('proximo_repaso', { ascending: true })
      .limit(MAX_POR_SESION)

    if (error) {
      console.error('Error cargando sesión:', error)
    } else {
      setCola(data)
    }
    setIndice(0)
    setSeleccion(null)
    setAciertos(0)
    setCargando(false)
  }

  async function cargarSesionLibre() {
    setCargando(true)
    const { data, error } = await supabase
      .from('gramatica')
      .select('*')
      .order('proximo_repaso', { ascending: true })
      .limit(MAX_POR_SESION)

    if (!error) setCola(data)
    setIndice(0)
    setSeleccion(null)
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
        body: JSON.stringify({ tema: 'gramatica' }),
      })
      const datos = await respuesta.json()

      if (datos.generadas > 0) {
        setMensajeRepaso(`✅ Se generaron ${datos.generadas} preguntas nuevas de tus errores reales.`)
        await cargarSesion()
      } else {
        setMensajeRepaso('No tienes errores nuevos pendientes de repasar. ¡Bien hecho!')
      }
    } catch (error) {
      console.error('Error generando repaso:', error)
      setMensajeRepaso('⚠️ No se pudo conectar con el servidor de Python.')
    } finally {
      setGenerandoRepaso(false)
    }
  }

  async function elegirOpcion(opcion) {
    if (seleccion) return
    setSeleccion(opcion)

    const p = cola[indice]
    const acerto = opcion === p.respuesta_correcta

    let nuevoIntervalo
    let camposActualizar = {}

    if (acerto) {
      nuevoIntervalo = Math.min((p.intervalo_dias || 1) * 2, 60)
      camposActualizar.veces_correcta = (p.veces_correcta || 0) + 1
      setAciertos((a) => a + 1)
    } else {
      nuevoIntervalo = 1
      camposActualizar.veces_incorrecta = (p.veces_incorrecta || 0) + 1
    }

    const proxima = new Date()
    proxima.setDate(proxima.getDate() + nuevoIntervalo)
    camposActualizar.intervalo_dias = nuevoIntervalo
    camposActualizar.proximo_repaso = proxima.toISOString().split('T')[0]

    await supabase.from('gramatica').update(camposActualizar).eq('id', p.id)
  }

  function siguiente() {
    setSeleccion(null)
    setIndice((i) => i + 1)
  }

  if (cargando) {
    return <div className="p-6 text-gray-400">Preparando tu repaso de hoy...</div>
  }

  const encabezado = (
    <div className="flex items-center justify-between mb-2">
      <h1 className="text-3xl font-black text-cyan-400">Gramática</h1>
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
        <p className="text-gray-400 mb-4">🎉 No tienes preguntas pendientes de repaso hoy.</p>
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
        <h2 className="text-2xl font-black text-gray-100 mb-2">¡Terminaste! 🎉</h2>
        <p className="text-gray-300 text-lg">
          Acertaste {aciertos} de {cola.length} preguntas.
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

  const p = cola[indice]
  const opciones = [p.opcion_a, p.opcion_b, p.opcion_c]

  return (
    <div className="p-6 max-w-xl">
      {encabezado}
      {mensajeRepaso && <p className="text-sm text-gray-400 mb-3">{mensajeRepaso}</p>}
      <p className="text-gray-500 text-sm mb-4">
        Pregunta {indice + 1} de {cola.length}
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