import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const NIVELES_MCERL = [
  { min: 0, nivel: 'A1', categoria: 'Básico', descripcion: 'Comprende y usa expresiones cotidianas y frases muy básicas.' },
  { min: 20, nivel: 'A2', categoria: 'Básico', descripcion: 'Comprende frases y vocabulario de uso frecuente.' },
  { min: 40, nivel: 'B1', categoria: 'Independiente', descripcion: 'Entiende los puntos principales de textos claros y estándar.' },
  { min: 60, nivel: 'B2', categoria: 'Independiente', descripcion: 'Entiende ideas principales de textos complejos, se relaciona con fluidez.' },
  { min: 80, nivel: 'C1', categoria: 'Competente', descripcion: 'Comprende una amplia variedad de textos extensos, se expresa con fluidez.' },
  { min: 92, nivel: 'C2', categoria: 'Competente', descripcion: 'Comprende con facilidad casi todo. Fluidez y precisión casi nativas.' },
]

function calcularNivel(promedio) {
  let resultado = NIVELES_MCERL[0]
  for (const n of NIVELES_MCERL) {
    if (promedio >= n.min) resultado = n
  }
  return resultado
}

function puntajeDesdeItems(items) {
  const practicados = items.filter((i) => (i.veces_correcta || 0) + (i.veces_incorrecta || 0) > 0)
  if (practicados.length === 0) return 0

  const dominados = practicados.filter((i) => (i.intervalo_dias || 1) >= 8).length
  return Math.round((dominados / practicados.length) * 100)
}

function Progreso() {
  const [cargando, setCargando] = useState(true)
  const [puntajes, setPuntajes] = useState({
    vocabulario: 0,
    gramatica: 0,
    pronunciacion: 0,
    conversacion: 0,
  })

  useEffect(() => {
    cargarProgreso()
  }, [])

  async function cargarProgreso() {
    setCargando(true)

    const [vocab, gram, pron, stats] = await Promise.all([
      supabase.from('vocabulario').select('veces_correcta, veces_incorrecta, intervalo_dias'),
      supabase.from('gramatica').select('veces_correcta, veces_incorrecta, intervalo_dias'),
      supabase.from('pronunciacion').select('veces_correcta, veces_incorrecta, intervalo_dias'),
      supabase.from('conversacion_stats').select('*').eq('id', 1).single(),
    ])

    const puntajeVocab = puntajeDesdeItems(vocab.data || [])
    const puntajeGram = puntajeDesdeItems(gram.data || [])
    const puntajePron = puntajeDesdeItems(pron.data || [])

    let puntajeConv = 0
    if (stats.data && stats.data.mensajes_totales > 0) {
      const tasaError = stats.data.mensajes_con_error / stats.data.mensajes_totales
      puntajeConv = Math.round((1 - tasaError) * 100)
    }

    setPuntajes({
      vocabulario: puntajeVocab,
      gramatica: puntajeGram,
      pronunciacion: puntajePron,
      conversacion: puntajeConv,
    })
    setCargando(false)
  }

  if (cargando) {
    return <div className="p-6 text-gray-400">Calculando tu progreso...</div>
  }

  const promedio = Math.round(
    (puntajes.vocabulario + puntajes.gramatica + puntajes.pronunciacion + puntajes.conversacion) / 4
  )
  const nivelActual = calcularNivel(promedio)

  const temas = [
    { nombre: 'Vocabulario', valor: puntajes.vocabulario, emoji: '📚' },
    { nombre: 'Gramática', valor: puntajes.gramatica, emoji: '✏️' },
    { nombre: 'Pronunciación', valor: puntajes.pronunciacion, emoji: '🎧' },
    { nombre: 'Conversación', valor: puntajes.conversacion, emoji: '💬' },
  ]

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-3xl font-black text-cyan-400 mb-6">Progreso</h1>

      <div className="bg-gradient-to-br from-cyan-400/10 to-gray-900 border border-cyan-400/30 rounded-xl p-6 mb-6 text-center">
        <p className="text-gray-400 text-sm mb-1">Tu nivel estimado (MCERL)</p>
        <p className="text-5xl font-black text-cyan-400 mb-1">{nivelActual.nivel}</p>
        <p className="text-gray-500 text-xs mb-2">{nivelActual.categoria}</p>
        <p className="text-gray-300 text-sm">{nivelActual.descripcion}</p>
        <p className="text-gray-600 text-xs mt-3">
          * Estimación personal basada en tu desempeño, no es una certificación oficial.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {temas.map((t) => (
          <div key={t.nombre} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-300 font-bold">
                {t.emoji} {t.nombre}
              </p>
              <p className="text-cyan-400 font-black text-xl">{t.valor}%</p>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className="bg-cyan-400 h-2 rounded-full transition-all"
                style={{ width: `${t.valor}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Progreso