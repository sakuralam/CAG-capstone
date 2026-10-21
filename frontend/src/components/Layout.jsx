// Page frame: top nav + the current page underneath.
// Pages render inside <Outlet /> (set up in App.jsx routes).
import { NavLink, Outlet } from "react-router-dom";
import "./components.css";

const NAV = [
  { to: "/", label: "Overview", end: true },
  { to: "/compare", label: "Compare" },
  { to: "/limits", label: "Limits" },
  { to: "/audit", label: "Audit log" },
  { to: "/cad/receptacle", label: "Receptacle 3D" },
     { to: "/cad/lpbd", label: "LPBD 3D" },
];

export default function Layout() {
  return (
    <div className="layout">
      <header className="nav">
        <span className="nav__brand">CAG Simulation</span>
        <nav className="nav__links">
          {NAV.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav__link${isActive ? " nav__link--active" : ""}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        {import.meta.env.VITE_USE_MOCKS === "true" && (
          <span className="nav__mock">Mock data</span>
        )}
      </header>
      <main className="layout__main">
        <Outlet />
      </main>
    </div>
  );
}