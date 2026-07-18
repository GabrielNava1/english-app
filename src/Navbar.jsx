import { NavLink } from 'react-router-dom'

function Navbar() {
  const links = [
    { to: '/', label: 'Vocabulario' },
    { to: '/gramatica', label: 'Gramática' },
    { to: '/conversacion', label: 'Conversación' },
    { to: '/pronunciacion', label: 'Pronunciación' },
    { to: '/progreso', label: 'Progreso' },
    { to: '/lectura', label: 'Lectura' },
  ]

  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex gap-2 flex-wrap">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) =>
            `px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
              isActive
                ? 'bg-cyan-400/10 text-cyan-400'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  )
}

export default Navbar