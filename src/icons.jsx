const stroke = { fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

export const Back = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" {...stroke}><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
);
export const Arrow = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" {...stroke}><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
);
export const Pause = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
);
export const Play = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="fill:var(--acc)"><polygon points="7 4 20 12 7 20" /></svg>
);
export const Swap = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" {...stroke}><path d="M8 3 4 7l4 4" /><path d="M4 7h16" /><path d="m16 21 4-4-4-4" /><path d="M20 17H4" /></svg>
);
export const Close = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 5l10 10" /><path d="M15 5 5 15" /></svg>
);
