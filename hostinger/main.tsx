import { createRoot } from 'react-dom/client';
import { lazy, Suspense } from 'react';
import Home from '../app/page';
import '../app/globals.css';
const Account = lazy(() => import('./account'));
const path = window.location.pathname.replace(/\/+$/, '') || '/';
createRoot(document.getElementById('root')!).render(
  path === '/' ? <Home /> : path === '/workspace' || path === '/personal' ?
    <Suspense fallback={<main className="wrap"><p role="status">Loading your workspace…</p></main>}><Account /></Suspense> :
    <main className="wrap"><h1>Page not found</h1><a href="/">Return to Mylekhpal</a></main>,
);
