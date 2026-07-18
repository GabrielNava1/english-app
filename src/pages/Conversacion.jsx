import { useState, useRef, useEffect } from 'react'
import { URL_SERVIDOR } from '../config'

function Conversacion() {
  const [modo, setModo] = useState('texto') // 'texto' | 'voz'
  const [mensajes, setMensajes] = useState([
    { autor: 'ia', texto: 'Hi! Let\'s practice English. Tell me about your day 😊' },
  ])
  const [entrada, setEntrada] = useState('')
  const [cargando, setCargando] = useState(false)
  const [escuchando, setEscuchando] = useState(false)
  const finalRef = useRef(null)
  const reconocimientoRef = useRef(null)
  const audioRef = useRef(new Audio())

  const modoRef = useRef(modo)
  useEffect(() => {
    modoRef.current = modo
  }, [modo])

  useEffect(() => {
    finalRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  // Configurar el reconocimiento de voz una sola vez
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const reconocimiento = new SpeechRecognition()
    reconocimiento.lang = 'en-US'
    reconocimiento.continuous = false
    reconocimiento.interimResults = false

    reconocimiento.onresult = (evento) => {
      const texto = evento.results[0][0].transcript
      enviarMensaje(texto)
    }

    reconocimiento.onend = () => setEscuchando(false)
    reconocimiento.onerror = () => setEscuchando(false)

    reconocimientoRef.current = reconocimiento
  }, [])

  async function reproducirVoz(texto) {
    try {
      const respuesta = await fetch(`${URL_SERVIDOR}/hablar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
      })
      if (!respuesta.ok) return
      const audioBlob = await respuesta.blob()
      audioRef.current.src = URL.createObjectURL(audioBlob)
      audioRef.current.play().catch((e) => console.error('No se pudo reproducir:', e))
    } catch (error) {
      console.error('Error generando voz:', error)
    }
  }

  async function enviarMensaje(textoManual) {
    audioRef.current.play().catch(() => {}) // desbloquea audio en iPhone, con el toque real del usuario
    audioRef.current.pause()
    const texto = (textoManual ?? entrada).trim()
    if (!texto || cargando) return

    setMensajes((prev) => [...prev, { autor: 'usuario', texto }])
    setEntrada('')
    setCargando(true)

    try {
      const respuesta = await fetch(`${URL_SERVIDOR}/conversar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje: texto }),
      })
      const datos = await respuesta.json()
      setMensajes((prev) => [...prev, { autor: 'ia', texto: datos.respuesta }])

      if (modoRef.current === 'voz') {
        reproducirVoz(datos.respuesta)
      }
    } catch (error) {
      console.error('Error hablando con el servidor:', error)
      setMensajes((prev) => [
        ...prev,
        { autor: 'ia', texto: '⚠️ No pude conectar con el servidor de Python. ¿Está corriendo?' },
      ])
    } finally {
      setCargando(false)
    }
  }

  function manejarEnter(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviarMensaje()
    }
  }

  function alternarMicrofono() {
    audioRef.current.play().catch(() => {})
    audioRef.current.pause()
    if (!reconocimientoRef.current) {
      alert('Tu navegador no soporta reconocimiento de voz. Prueba con Chrome o Edge.')
      return
    }
    if (escuchando) {
      reconocimientoRef.current.stop()
    } else {
      setEscuchando(true)
      reconocimientoRef.current.start()
    }
  }

  return (
    <div className="p-6 max-w-2xl flex flex-col h-[calc(100vh-72px)]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-black text-cyan-400">Conversación</h1>
        <div className="flex bg-gray-900 border border-gray-800 rounded-lg p-1">
          <button
            onClick={() => setModo('texto')}
            className={`px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${
              modo === 'texto' ? 'bg-cyan-400/10 text-cyan-400' : 'text-gray-500'
            }`}
          >
            💬 Texto
          </button>
          <button
            onClick={() => setModo('voz')}
            className={`px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${
              modo === 'voz' ? 'bg-cyan-400/10 text-cyan-400' : 'text-gray-500'
            }`}
          >
            🎙️ Voz
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pb-4">
        {mensajes.map((m, i) => (
          <div
            key={i}
            className={`max-w-[80%] rounded-xl px-4 py-3 whitespace-pre-wrap ${
              m.autor === 'usuario'
                ? 'self-end bg-cyan-400/10 text-cyan-100 border border-cyan-400/30'
                : 'self-start bg-gray-900 text-gray-200 border border-gray-800'
            }`}
          >
            {m.texto}
          </div>
        ))}
        {cargando && (
          <div className="self-start bg-gray-900 text-gray-500 border border-gray-800 rounded-xl px-4 py-3">
            Escribiendo...
          </div>
        )}
        <div ref={finalRef} />
      </div>

      {modo === 'texto' ? (
        <div className="flex gap-2 pt-2 border-t border-gray-800">
          <textarea
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            onKeyDown={manejarEnter}
            placeholder="Escribe en inglés o español..."
            rows={1}
            className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-gray-100 resize-none focus:outline-none focus:border-cyan-400/50"
          />
          <button
            onClick={() => enviarMensaje()}
            disabled={cargando}
            className="bg-cyan-400/10 text-cyan-400 font-bold px-4 py-2 rounded-lg hover:bg-cyan-400/20 disabled:opacity-50"
          >
            Enviar
          </button>
        </div>
      ) : (
        <div className="pt-4 border-t border-gray-800 flex flex-col items-center gap-2">
          <button
            onClick={alternarMicrofono}
            disabled={cargando}
            className={`text-5xl w-20 h-20 rounded-full flex items-center justify-center transition-colors ${
              escuchando
                ? 'bg-red-500/20 animate-pulse'
                : 'bg-cyan-400/10 hover:bg-cyan-400/20'
            }`}
          >
            🎤
          </button>
          <p className="text-gray-500 text-sm">
            {escuchando ? 'Escuchando... habla ahora' : 'Dale clic y habla en inglés'}
          </p>
        </div>
      )}
    </div>
  )
}

export default Conversacion