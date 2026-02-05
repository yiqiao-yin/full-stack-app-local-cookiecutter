interface NavbarProps {
  onLogout: () => void
}

export default function Navbar({ onLogout }: NavbarProps) {
  return (
    <nav className="navbar">
      <div className="navbar-brand">StockView</div>
      <button className="navbar-logout" onClick={onLogout}>
        Logout
      </button>
    </nav>
  )
}
