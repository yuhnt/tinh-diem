import { hydrate, render } from 'preact';
import { App } from './App.jsx';
import './styles.css';

const root = document.getElementById('app');
// The home screen is prerendered at build time; hydrate it instead of re-rendering.
(root.firstElementChild ? hydrate : render)(<App />, root);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
