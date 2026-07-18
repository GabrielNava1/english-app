import { useState, useRef, useEffect } from 'react'

function Conversacion() {
  const [mensajes, setMensajes] = useState([
    { autor: 'ia', texto: 'Hi! Let\'s practice English. Tell me about your day 😊' },
  ])
  const [entrada, setEntrada] = useState('')
  const [cargando, setCargando] = useState(false)
  const finalRef = useRef(null)

  useEffect(() => {
    finalRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  async function enviarMensaje() {
    const texto = entrada.trim()
    if (!texto || cargando) return

    setMensajes((prev) => [...prev, { autor: 'usuario', texto }])
    setEntrada('')
    setCargando(true)

    try {
      const respuesta = await fetch('http://127.0.0.1:5000/conversar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje: texto }),
      })
      const datos = await respuesta.json()
      setMensajes((prev) => [...prev, { autor: 'ia', texto: datos.respuesta }])
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

  return (
    <div className="p-6 max-w-2xl flex flex-col h-[calc(100vh-72px)]">
      <h1 className="text-3xl font-black text-cyan-400 mb-4">Conversación</h1>

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
          onClick={enviarMensaje}
          disabled={cargando}
          className="bg-cyan-400/10 text-cyan-400 font-bold px-4 py-2 rounded-lg hover:bg-cyan-400/20 disabled:opacity-50"
        >
          Enviar
        </button>
      </div>
    </div>
  )
}

export default Conversacion