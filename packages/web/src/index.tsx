/* @refresh reload */
import { render } from 'solid-js/web';
import { Router, Route, Navigate } from '@solidjs/router';
import { lazy } from 'solid-js';
import App from './App';
import './styles/app.css';

// Lazy load routes
const BibleRoute = lazy(() => import('./routes/bible'));
const EgwRoute = lazy(() => import('./routes/egw'));

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

render(
  () => (
    <Router root={App}>
      <Route path="/" component={() => <Navigate href="/bible" />} />
      <Route path="/bible/:book?/:chapter?/:verse?" component={BibleRoute} />
      <Route path="/egw/:bookCode?/:page?" component={EgwRoute} />
    </Router>
  ),
  root,
);
