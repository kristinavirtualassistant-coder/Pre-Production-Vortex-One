import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { isOwnerPath } from './owner/router.ts';

const root = createRoot(document.getElementById('root')!);

if (isOwnerPath(window.location.pathname)) {
  // The Owner Portal is a separate application shell: it shares no providers, navigation or state with the customer app,
  // and its code is only loaded for /owner/* URLs. Access is decided by the server, never by this routing.
  document.title = 'Vortex One Owner Portal';
  const noindex = document.createElement('meta');
  noindex.name = 'robots'; noindex.content = 'noindex, nofollow';
  document.head.appendChild(noindex);
  const OwnerApp = lazy(() => import('./owner/OwnerApp.tsx'));
  root.render(<StrictMode><Suspense fallback={null}><OwnerApp /></Suspense></StrictMode>);
} else {
  void Promise.all([
    import('./App.tsx'),
    import('./contexts/ThemeContext.tsx'),
    import('./contexts/ToastContext.tsx'),
    import('./contexts/AuthContext.tsx'),
  ]).then(([{ default: App }, { ThemeProvider }, { ToastProvider }, { AuthProvider }]) => {
    root.render(
      <StrictMode>
        <ToastProvider>
          <AuthProvider>
            <ThemeProvider>
              <App />
            </ThemeProvider>
          </AuthProvider>
        </ToastProvider>
      </StrictMode>,
    );
  });
}
