import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { URL_SERVIDOR } from '../config'

const MAX_POR_SESION = 10 // no saturar, tanda manejable

function Vocabulario() {
  const [cola, setCola] = useState([])
  const [indice, setIndice] = useState(0)
  const [revelado, setRevelado] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [resumen, setResumen] = useState({ bien: 0, mal: 0 })

  useEffect(() => {
    cargarSesion()
  }, [])

  async function cargarSesion() {
    setCargando(true)
    const hoy = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('vocabulario')
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
    setRevelado(false)
    setResumen({ bien: 0, mal: 0 })
    setCargando(false)
  }

  async function cargarSesionLibre() {
    setCargando(true)
    const { data, error } = await supabase
      .from('vocabulario')
      .select('*')
      .order('proximo_repaso', { ascending: true })
      .limit(MAX_POR_SESION)

    if (!error) setCola(data)
    setIndice(0)
    setRevelado(false)
    setResumen({ bien: 0, mal: 0 })
    setCargando(false)
  }

  async function responder(nivel) {
    // nivel: 'mal' | 'aprendiendo' | 'domino'
    const palabra = cola[indice]
    let nuevoIntervalo
    let camposActualizar = {}

    if (nivel === 'mal') {
      nuevoIntervalo = 1
      camposActualizar.veces_incorrecta = (palabra.veces_incorrecta || 0) + 1
    } else if (nivel === 'aprendiendo') {
      nuevoIntervalo = 2 // se acerca pronto otra vez, aunque la hayas sabido
      camposActualizar.veces_correcta = (palabra.veces_correcta || 0) + 1
    } else {
      nuevoIntervalo = Math.min((palabra.intervalo_dias || 1) * 2, 60)
      camposActualizar.veces_correcta = (palabra.veces_correcta || 0) + 1
    }

    const proxima = new Date()
    proxima.setDate(proxima.getDate() + nuevoIntervalo)
    camposActualizar.intervalo_dias = nuevoIntervalo
    camposActualizar.proximo_repaso = proxima.toISOString().split('T')[0]

    await supabase.from('vocabulario').update(camposActualizar).eq('id', palabra.id)

    setResumen((r) => ({
      bien: r.bien + (nivel !== 'mal' ? 1 : 0),
      mal: r.mal + (nivel === 'mal' ? 1 : 0),
    }))

    setRevelado(false)
    setIndice((i) => i + 1)
  }

  async function escuchar(palabraIngles) {
    try {
      const respuesta = await fetch(`${URL_SERVIDOR}/pronunciar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ palabra: palabraIngles }),
      })
      if (!respuesta.ok) return
      const audioBlob = await respuesta.blob()
      const audio = new Audio(URL.createObjectURL(audioBlob))
      audio.play()
    } catch (error) {
      console.error('Error con el servidor de Python:', error)
    }
  }

  if (cargando) {
    return <div className="p-6 text-gray-400">Preparando tu repaso de hoy...</div>
  }

  if (cola.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-black text-cyan-400 mb-2">Vocabulario</h1>
        <p className="text-gray-400 mb-4">
          🎉 No tienes palabras pendientes de repaso hoy.
        </p>
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
        <h1 className="text-3xl font-black text-cyan-400 mb-4">¡Sesión terminada! 🎉</h1>
        <p className="text-gray-300 text-lg">
          Acertaste {resumen.bien} y fallaste {resumen.mal} de {cola.length} palabras.
        </p>
        <button
          onClick={cargarSesion}
          className="mt-4 bg-cyan-400/10 text-cyan-400 font-bold px-4 py-2 rounded-lg hover:bg-cyan-400/20"
        >
          Revisar de nuevo
        </button>
      </div>
    )
  }

  const p = cola[indice]

  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-3xl font-black text-cyan-400 mb-2">Vocabulario</h1>
      <p className="text-gray-500 text-sm mb-6">
        Palabra {indice + 1} de {cola.length}
      </p>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
        <p className="text-gray-400 text-sm mb-2">¿Cómo se dice...?</p>
        <p className="text-3xl font-black text-gray-100 mb-4">{p.palabra_es}</p>

        {!revelado ? (
          <button
            onClick={() => setRevelado(true)}
            className="bg-cyan-400/10 text-cyan-400 font-bold px-4 py-2 rounded-lg hover:bg-cyan-400/20"
          >
            Ver respuesta
          </button>
        ) : (
          <div>
            <p className="text-2xl font-black text-cyan-400">{p.palabra_en}</p>
            <p className="text-gray-400 text-sm mt-1 mb-2">/{p.pronunciacion}/</p>
            {p.contexto_ejemplo && (
              <p className="text-gray-500 text-sm italic mb-4">"{p.contexto_ejemplo}"</p>
            )}
            <button
              onClick={() => escuchar(p.palabra_en)}
              className="text-sm bg-gray-800 text-cyan-400 px-3 py-1.5 rounded-lg hover:bg-gray-700 mb-4"
            >
              🔊 Escuchar
            </button>

            <div className="flex flex-col sm:flex-row gap-2 mt-2">
              <button
                onClick={() => responder('mal')}
                className="flex-1 bg-red-500/10 text-red-400 border border-red-500/30 font-bold py-3 rounded-lg hover:bg-red-500/20"
              >
                No lo sabía 👎
              </button>
              <button
                onClick={() => responder('aprendiendo')}
                className="flex-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 font-bold py-3 rounded-lg hover:bg-yellow-500/20"
              >
                Aprendiendo 🌱
              </button>
              <button
                onClick={() => responder('domino')}
                className="flex-1 bg-cyan-400/10 text-cyan-400 border border-cyan-400/30 font-bold py-3 rounded-lg hover:bg-cyan-400/20"
              >
                La domino 💪
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Vocabulario