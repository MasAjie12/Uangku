import React from 'react'

export default function Footer() {
  const tahun = new Date().getFullYear()

  return (
    <footer className="app-footer">
      <span className="footer-copyright-icon" aria-hidden="true">©</span>
      <span>{tahun} Aji Setiawan</span>
    </footer>
  )
}
