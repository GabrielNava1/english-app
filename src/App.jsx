import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './Navbar'
import Vocabulario from './pages/Vocabulario'
import Gramatica from './pages/Gramatica'
import Conversacion from './pages/Conversacion'
import Pronunciacion from './pages/Pronunciacion'
import Progreso from './pages/Progreso'
import Lectura from './pages/Lectura'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950">
        <Navbar />
        <Routes>
          <Route path="/" element={<Vocabulario />} />
          <Route path="/gramatica" element={<Gramatica />} />
          <Route path="/conversacion" element={<Conversacion />} />
          <Route path="/pronunciacion" element={<Pronunciacion />} />
          <Route path="/progreso" element={<Progreso />} />
          <Route path="/lectura" element={<Lectura />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App