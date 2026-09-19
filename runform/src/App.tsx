import { useEffect, useState } from 'react';
import { EvolutionPage } from './ui/EvolutionPage';
import { GuidePage } from './ui/GuidePage';
import { HomePage, type NavTarget } from './ui/HomePage';
import { Icon, type IconName } from './ui/icons';
import { SessionsPage } from './ui/SessionsPage';
import { VideoAnalyzer } from './ui/VideoAnalyzer';

type Page = 'home' | NavTarget;
type Theme = 'light' | 'dark';

const NAV: Array<{ id: Page; label: string; icon: IconName }> = [
  { id: 'home', label: 'Inicio', icon: 'gauge' },
  { id: 'analyze', label: 'Analizar', icon: 'video' },
  { id: 'sessions', label: 'Sesiones', icon: 'list' },
  { id: 'evolution', label: 'Evolución', icon: 'chart' },
  { id: 'guide', label: 'Guía', icon: 'book' },
];

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem('optirun.theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* sin storage */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [sessionsVersion, setSessionsVersion] = useState(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('optirun.theme', theme);
    } catch {
      /* sin storage */
    }
  }, [theme]);

  return (
    <div className="shell">
      <nav className="nav" aria-label="Principal">
        <div className="brand">
          <div className="brand-mark">
            <Icon name="activity" size={20} />
          </div>
          <div>
            <div className="brand-name">OptiRun</div>
            <div className="brand-sub">Técnica de carrera</div>
          </div>
        </div>

        {NAV.map((n) => (
          <button
            key={n.id}
            className="nav-item"
            aria-current={page === n.id ? 'page' : undefined}
            onClick={() => setPage(n.id)}
            title={n.label}
          >
            <Icon name={n.icon} />
            <span>{n.label}</span>
          </button>
        ))}

        <div className="nav-spacer" />

        <div className="nav-foot">
          <span>Todo en tu navegador</span>
          <button
            className="btn-icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
            aria-label="Cambiar tema"
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
          </button>
        </div>
      </nav>

      <main className="main">
        <div className="container page-enter" key={page}>
          {page === 'home' && <HomePage onNavigate={setPage} />}
          {page === 'analyze' && (
            <VideoAnalyzer
              onSaved={() => {
                setSessionsVersion((v) => v + 1);
              }}
            />
          )}
          {page === 'sessions' && <SessionsPage key={sessionsVersion} onNavigate={setPage} />}
          {page === 'evolution' && <EvolutionPage onNavigate={setPage} />}
          {page === 'guide' && <GuidePage />}
        </div>
      </main>
    </div>
  );
}
