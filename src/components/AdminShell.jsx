import { Link, NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/admin', end: true, label: 'Conteúdo', hint: 'Textos, links e contato' },
  { to: '/admin/visuais', end: false, label: 'Visuais', hint: 'Faixas, logos e fundos' },
  { to: '/admin/fotos', end: false, label: 'Fotos', hint: 'Galeria e role' },
  { to: '/admin/editorial', end: false, label: 'Matérias', hint: 'Editorial e mosaico' },
  { to: '/admin/calendario', end: false, label: 'Agenda', hint: 'Eventos e posters' },
  { to: '/admin/reservas', end: false, label: 'Reservas', hint: 'Mapa e mesas' },
];

const SECTION_TITLES = {
  geral: 'Conteúdo do site',
  visuais: 'Elementos visuais',
  fotos: 'Fotos',
  editorial: 'Matérias',
  calendario: 'Agenda',
  reservas: 'Reservas',
};

/**
 * Shell visual do painel: sidebar + topbar.
 * Não altera a lógica das seções — só enquadra o conteúdo.
 */
export function AdminShell({
  adminSection = 'geral',
  title,
  actions = null,
  onLogout,
  children,
}) {
  const heading = title || SECTION_TITLES[adminSection] || 'Painel';

  return (
    <div className="admin-app">
      <aside className="admin-sidebar" aria-label="Navegação do painel">
        <div className="admin-sidebar__brand">
          <Link to="/admin" className="admin-sidebar__logo" aria-label="Douha Admin">
            <img src="/brand/logos/header-v9.svg" alt="" />
            <span>Admin</span>
          </Link>
          <p className="admin-sidebar__tag">Painel Douha Club</p>
        </div>

        <nav className="admin-sidebar__nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `admin-sidebar__link${isActive ? ' is-active' : ''}`}
            >
              <strong>{item.label}</strong>
              <span>{item.hint}</span>
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar__footer">
          <Link className="admin-sidebar__site-link" to="/" target="_blank" rel="noreferrer">
            Ver site ↗
          </Link>
          {typeof onLogout === 'function' ? (
            <button type="button" className="admin-sidebar__logout" onClick={onLogout}>
              Sair
            </button>
          ) : null}
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar__titles">
            <p className="admin-topbar__eyebrow">Douha Admin</p>
            <h1 className="admin-topbar__title">{heading}</h1>
          </div>
          {actions ? <div className="admin-topbar__actions">{actions}</div> : null}
        </header>

        <div className="admin-main__body">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Tela de login isolada (sem sidebar). */
export function AdminLoginScreen({ children }) {
  return (
    <div className="admin-login-screen">
      <div className="admin-login-card">
        <div className="admin-login-card__brand">
          <img src="/brand/logos/header-v9.svg" alt="" />
          <p>Douha Admin</p>
        </div>
        {children}
      </div>
      <Link className="admin-login-screen__back" to="/">← Voltar ao site</Link>
    </div>
  );
}
