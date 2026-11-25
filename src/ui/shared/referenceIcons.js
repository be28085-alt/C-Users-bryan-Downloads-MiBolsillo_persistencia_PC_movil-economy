/* Presentation only: replace decorative emoji in the active UI with the same
   small line icons. Observe rendered nodes so controller refreshes keep them. */
(function () {
  'use strict';
  if (!document.body || typeof document.body.querySelectorAll !== 'function'
    || typeof MutationObserver !== 'function') return;
  const paths = {
    home: 'M3 10 12 3l9 7v10H3ZM9 20v-7h6v7',
    movements: 'M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4',
    plus: 'M12 5v14M5 12h14',
    plan: 'M4 5h16v16H4ZM8 3v4m8-4v4M4 11h16M8 15h3m-3 3h7',
    savings: 'M8 5h8l-2 4c5 3 7 6 5 10-1 2-13 2-14 0-2-4 0-7 5-10ZM9 9h6m-3 3v5m-2-1h4',
    card: 'M3 5h18v14H3ZM3 10h18M7 15h4',
    reports: 'M4 20h16M6 16v-4m6 4V8m6 8V4',
    settings: 'M4 7h16M4 17h16M8 4v6m8 4v6',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm7 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0',
    basket: 'M3 9h18l-2 11H5ZM8 9l4-6 4 6M9 13v3m6-3v3',
    bus: 'M5 17h14V5c0-3-14-3-14 0ZM5 10h14M8 17v3m8-3v3M8 14h.01M16 14h.01',
    coffee: 'M4 8h12v8c0 5-12 5-12 0ZM16 9h3a3 3 0 0 1 0 6h-3M7 3v2m5-2v2',
    health: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z',
    briefcase: 'M3 7h18v13H3ZM8 7V3h8v4M3 12l9 3 9-3M10 12h4',
    laptop: 'M5 4h14v12H5ZM2 20h20l-3-4H5Z',
    tag: 'M3 3h9l9 9-9 9-9-9ZM7 7h.01',
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    inventory: 'm3 7 9-4 9 4v11l-9 4-9-4ZM3 7l9 4 9-4M12 11v11',
    people: 'M9 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6M3 21v-4c0-6 12-6 12 0v4m1-17a3 3 0 0 1 0 6m2 4c3 0 3 4 3 7',
    receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2ZM9 7h6M9 11h6M9 15h3',
    folder: 'M3 6h7l2 3h9v12H3ZM3 6V3h7l2 3h9v3',
    brand: 'M4 4h6v6H4Zm10 0h6v6h-6ZM4 14h6v6H4Zm10 0h6v6h-6Z'
  };
  const tokens = {
    '🏠': 'home', '⇋': 'movements', '⊕': 'plus', '🎯': 'plan',
    '🐖': 'savings', '💳': 'card', '📊': 'reports', '📈': 'reports',
    '⚙️': 'settings', '👁️': 'eye', '🛒': 'basket', '🚌': 'bus',
    '☕': 'coffee', '⚕️': 'health', '💼': 'briefcase', '💻': 'laptop',
    '🏷️': 'tag', '···': 'more', '✨': 'more', '📦': 'inventory',
    '🏢': 'home', '👥': 'people', '🧾': 'receipt', '🗂️': 'folder',
    '❖': 'brand'
  };
  const selector = '.nav-icon, .nav-btn > span:first-child, .cat-icon, .tx-icon-bubble, .mov-icon-bubble, .btn-kpi-eye, .btn-eye-toggle, .brand-icon-coin';
  function decorate(root) {
    if (!root || root.nodeType !== 1 || typeof root.matches !== 'function') return;
    const nodes = [...(root.matches(selector) ? [root] : []), ...root.querySelectorAll(selector)];
    for (const node of nodes) {
      if (node.querySelector('svg')) continue;
      const key = tokens[node.textContent.trim()];
      if (!key) continue;
      node.innerHTML = `<svg class="reference-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[key]}"/></svg>`;
    }
  }
  decorate(document.body);
  new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) {
      if (node.nodeType === 1) decorate(node);
      else if (node.nodeType === 3 && node.parentElement?.matches(selector)) decorate(node.parentElement);
    }
  }).observe(document.body, { childList: true, subtree: true });
})();
