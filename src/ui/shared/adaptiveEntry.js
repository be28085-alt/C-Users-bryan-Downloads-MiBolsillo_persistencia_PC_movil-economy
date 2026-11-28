/**
 * Una única pantalla activa dentro de la entrada adaptable. Redimensionar cambia la
 * presentación, sin recargar el documento financiero ni duplicar su estado.
 */
/* One live document and one financial controller. CSS reflows the same fields;
   no preference, iframe navigation or duplicated financial state is involved. */
(function () {
  'use strict';
  if (typeof document.getElementById !== 'function') return;
  const shell = document.getElementById('mibolsillo-app');
  if (shell) {
    const status = document.getElementById('entry-status');
    let opened = false;
    let loading = false;
    const update = () => {
      document.documentElement.dataset.layout = innerWidth < 800 ? 'compact' : 'wide';
    };
    update();
    window.addEventListener('resize', update, { passive: true });
    shell.addEventListener('load', () => {
      if (!opened) return;
      loading = false;
      if (status) status.hidden = true;
    });
    window.MiBolsilloEntry = Object.freeze({
      open() {
        document.getElementById('account-access').hidden = true;
        shell.hidden = false;
        if (!opened) {
          opened = true;
          loading = true;
          const url = new URL('desktop.html', location.href);
          if (new URLSearchParams(location.search).get('modulo') === 'EMPRESARIAL') {
            url.searchParams.set('modulo', 'EMPRESARIAL');
          }
          shell.src = url.href;
        }
        return shell;
      },
      close() {
        opened = false;
        loading = false;
        shell.hidden = true;
        shell.removeAttribute('src');
        shell.src = 'about:blank';
        if (status) status.hidden = true;
      },
      inspect() {
        return {
          layout: innerWidth < 800 ? 'mobile' : 'desktop',
          opened,
          loading,
          breakpoint: 800,
        };
      },
    });
    return;
  }
  // Both interfaces display the saved person's identity, independently of the
  // active workspace. Changing workspace remains a profile action.
  const renderProfileShortcut = (state) => {
    const user = state?.usuario;
    if (!user || typeof document.querySelectorAll !== 'function') return;
    const name = user.nombre || 'Usuario';
    const initials =
      user.iniciales ||
      name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();
    document.querySelectorAll('[data-profile-name]').forEach((node) => {
      node.textContent = name;
    });
    document.querySelectorAll('[data-profile-initials]').forEach((node) => {
      node.textContent = initials;
    });
    document.querySelectorAll('.app-profile-shortcut').forEach((button) => {
      button.title = 'Abrir perfil de ' + name;
    });
    document.querySelectorAll('[data-profile-location]').forEach((node) => {
      node.textContent = `${state.moduloActivo === 'EMPRESARIAL' ? 'Mi Negocio' : 'Personal'} / Perfil`;
    });
  };
  renderProfileShortcut(window.Finanzas?.state);
  window.Finanzas?.subscribe(renderProfileShortcut);
  // The standalone mobile page retains its existing controller and layout.
  const sidebar = document.getElementById('pcSidebar');
  if (!sidebar) return;
  if (document.getElementById('responsiveBottomNav')) return;
  const nav = document.createElement('nav');
  nav.id = 'responsiveBottomNav';
  nav.setAttribute('aria-label', 'Navegación principal');
  const menu = document.createElement('dialog');
  menu.id = 'responsiveMenu';
  menu.setAttribute('aria-label', 'Todas las secciones');
  const menuHead = document.createElement('header');
  menuHead.innerHTML =
    '<strong>Tu espacio</strong><button type="button" aria-label="Cerrar menú">✕</button>';
  menuHead.querySelector('button').addEventListener('click', () => menu.close());
  const menuLinks = document.createElement('div');
  menuLinks.className = 'responsive-menu-links';
  menu.append(menuHead, menuLinks);
  document.body.append(nav, menu);
  menu.addEventListener('click', (event) => {
    if (event.target === menu) menu.close();
  });

  let scheduled = false;
  function update() {
    scheduled = false;
    const business =
      document.getElementById('navEmpresarial')?.style.display !== 'none' &&
      getComputedStyle(document.getElementById('navEmpresarial')).display !== 'none';
    const sourceMenu = document.getElementById(business ? 'navEmpresarial' : 'navPersonal');
    const sources = [...sourceMenu.querySelectorAll('button[data-view]')];
    const current = sources.find((button) => button.classList.contains('active'))?.dataset.view;
    const routes = business
      ? ['negocio-dashboard', 'negocio-inventario', 'negocio-ventas', 'negocio-informes']
      : ['inicio', 'movimientos', 'registrar', 'plan'];
    const create = (source) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.responsiveView = source.dataset.view;
      button.className = source.classList.contains('active') ? 'active' : '';
      button.setAttribute('aria-current', source.classList.contains('active') ? 'page' : 'false');
      button.innerHTML = source.innerHTML;
      button.addEventListener('click', () => {
        source.click();
        menu.close();
      });
      return button;
    };
    nav.replaceChildren();
    for (const route of routes) {
      const source = sources.find((button) => button.dataset.view === route);
      if (source) {
        const button = create(source);
        if (route === 'registrar' && button.lastElementChild) {
          button.lastElementChild.textContent = 'Registrar';
        }
        nav.append(button);
      }
    }
    const more = document.createElement('button');
    more.type = 'button';
    more.innerHTML = '<span aria-hidden="true">☰</span><span>Más</span>';
    more.className = routes.includes(current) ? '' : 'active';
    more.setAttribute('aria-label', 'Más secciones');
    more.addEventListener('click', () => menu.showModal());
    nav.append(more);
    menuLinks.replaceChildren(...sources.map(create));
    for (const table of document.querySelectorAll('.pc-table')) {
      const headers = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim());
      for (const row of table.querySelectorAll('tbody tr')) {
        [...row.children].forEach((cell, index) => {
          if (cell.colSpan === 1 && headers[index] && cell.dataset.label !== headers[index]) {
            cell.dataset.label = headers[index];
          }
        });
      }
    }
  }
  const schedule = () => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(update);
    }
  };
  new MutationObserver(schedule).observe(sidebar, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style'],
  });
  const content = document.querySelector('.pc-views-container');
  if (content) new MutationObserver(schedule).observe(content, { childList: true, subtree: true });
  window.addEventListener(
    'resize',
    () => {
      if (innerWidth >= 800 && menu.open) menu.close();
    },
    { passive: true },
  );
  update();
})();
