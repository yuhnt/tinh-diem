import { renderToString } from 'preact-render-to-string';
import { App } from './App.jsx';

export const prerender = () => renderToString(<App />);
