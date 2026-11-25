/* Persistent, quiet reminders inside the app; no operating-system permissions. */
(function () {
  'use strict';
  function init() {
    const anchor = document.getElementById('pcDashboardAlerts') || document.getElementById('mobileDashboardAlerts');
    if (!anchor || !window.Finanzas) return;
    const host = document.createElement('section');
    host.className = document.getElementById('pcDashboardAlerts') ? 'pc-card' : 'section-card';
    host.setAttribute('aria-label', 'Vencimientos de deudas');
    host.style.cssText = 'order:3;margin-bottom:16px;';
    anchor.after(host);
    function render() {
      const items = Finanzas.getRecordatoriosDeudas();
      host.replaceChildren(); host.hidden = !items.length;
      if (!items.length) return;
      const title = document.createElement('h3'); title.textContent = 'Próximos pagos'; title.style.fontSize = '1rem'; host.append(title);
      for (const item of items) {
        const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;';
        const text = document.createElement('div'), name = document.createElement('strong'), date = document.createElement('small');
        name.textContent = item.nombre; name.style.display = 'block';
        date.textContent = `${item.dias < 0 ? 'Vencido' : 'Vence'}: ${item.fecha} · ${formatCOP(item.monto)}`;
        const button = document.createElement('button'); button.type = 'button'; button.className = 'btn-pc-secondary'; button.textContent = 'Revisado'; button.style.minHeight = '44px';
        button.addEventListener('click', async () => {
          button.disabled = true;
          const out = await Finanzas.descartarRecordatorio(item.id);
          if (out.error) { date.textContent = out.error; button.disabled = false; }
        });
        text.append(name, date); row.append(text, button); host.append(row);
      }
    }
    Finanzas.subscribe(render); render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
