/**
 * Ayudas de escritura sin sustituir validaciones del caso de uso o servidor. No reformatear
 * valores durante la edición de forma que se pierda la posibilidad de corregirlos.
 */
(function () {
  'use strict';
  if (typeof document.querySelectorAll !== 'function') return;
  const editing = new WeakMap();
  function policy(input) {
    if (!input?.matches?.('input,textarea') || input.readOnly || input.disabled) return null;
    const name = `${input.name || ''} ${input.id || ''}`.toLowerCase();
    if (
      input.tagName === 'TEXTAREA' ||
      [
        'email',
        'password',
        'search',
        'date',
        'month',
        'time',
        'hidden',
        'checkbox',
        'radio',
        'file',
      ].includes(input.type) ||
      /search|buscar|sku|codigo|código|direccion|address|descripcion|description|concepto|observaci|notas|notes|condiciones|plazo|periodo/.test(
        name,
      )
    ) {
      return null;
    }
    if (input.type === 'tel' || /telefono|phone/.test(name)) {
      return { kind: 'phone', valid: (value) => /^[+\d\s().-]*$/.test(value) };
    }
    if (/cedula|documento|(?:^|\s)(?:document|nit)(?:\s|$)|identifica/.test(name)) {
      const type = input.form?.querySelector('[name="tipoDocumento"],[name="documentType"]')?.value;
      return {
        kind: 'document',
        valid: (value) =>
          (['CE', 'PASAPORTE'].includes(type) ? /^[\p{L}\d\s.-]*$/u : /^[\d\s.-]*$/).test(value),
      };
    }
    if (
      input.type === 'number' ||
      input.dataset.bmNumber ||
      input.inputMode === 'decimal' ||
      /monto|precio|costo|salario|importe|valor|amount|price|presupuesto|objetivo|ahorrado|saldo|cuota|stock|cantidad|quantity|discount|porcentaje/.test(
        name,
      )
    ) {
      const signed =
        input.type === 'number' && (!input.hasAttribute('min') || Number(input.min) < 0);
      return {
        kind: 'number',
        valid: (value) => (signed ? /^-?[\d.,]*$/ : /^[\d.,]*$/).test(value),
      };
    }
    if (
      /nombre|(?:^|\s)name(?:\s|$)|(?:first|last|full)name|categoria|cargo|unidadpersonalizada/.test(
        name,
      )
    ) {
      return { kind: 'letters', valid: (value) => /^[\p{L}\p{M}\s.'’&()/-]*$/u.test(value) };
    }
    return null;
  }
  function state(input) {
    if (!editing.has(input)) editing.set(input, { previous: input.value, replaceZero: false });
    return editing.get(input);
  }
  function validateInput(input) {
    const rule = policy(input);
    if (!rule) return;
    const current = state(input);
    if (rule.valid(input.value)) current.previous = input.value;
    else input.value = current.previous;
  }
  function example(input) {
    const name =
      `${input.name || ''} ${input.id || ''} ${input.closest('label')?.textContent || ''}`.toLowerCase();
    if (/password/.test(input.type)) return 'Ej.: una contraseña segura';
    if (input.type === 'email' || /correo|email/.test(name)) return 'Ej.: nombre@correo.com';
    if (input.type === 'tel' || /telefono|teléfono/.test(name)) return 'Ej.: 3001234567';
    if (/cedula|identifica|documento|document$/.test(name)) return 'Ej.: 123456789';
    if (/sku|código|codigo/.test(name)) return 'Ej.: PROD-001';
    if (/porcentaje|descuento|percent|impuesto/.test(name)) return 'Ej.: 0';
    if (/stock|cantidad|quantity|existencia/.test(name)) return 'Ej.: 1,5';
    if (
      input.dataset.bmNumber === 'money' ||
      /monto|precio|costo|salario|importe|valor|amount|price|presupuesto|objetivo|saldo|cuota/.test(
        name,
      )
    ) {
      return '0.000.00';
    }
    if (input.type === 'number' || input.inputMode === 'decimal') return 'Ej.: 0';
    if (/unidad/.test(name)) return 'Ej.: Rollo';
    if (/direcci|address/.test(name)) return 'Ej.: Calle 10 # 20-30';
    if (/buscar|search|filtrar/.test(name)) return 'Ej.: nombre o referencia';
    if (/nombre|name|razón/.test(name)) {
      const title = input.closest('dialog')?.querySelector('h1,h2')?.textContent || '';
      if (/producto/i.test(title)) return 'Ej.: Arroz';
      if (/proveedor/i.test(title)) return 'Ej.: Distribuciones Central';
      if (/negocio/i.test(title)) return 'Ej.: Mi tienda';
      if (/meta/i.test(title)) return 'Ej.: Viaje';
      return 'Ej.: María Pérez';
    }
    if (/categoria|categoría/.test(name)) return 'Ej.: Servicios';
    if (/periodo|período/.test(name)) return 'Ej.: 2026-11';
    return 'Ej.: descripción del registro';
  }
  function decorate(root) {
    const inputs = root.matches?.('input,textarea')
      ? [root]
      : root.querySelectorAll('input,textarea');
    for (const input of inputs) {
      if (
        [
          'hidden',
          'date',
          'month',
          'time',
          'checkbox',
          'radio',
          'file',
          'submit',
          'button',
          'range',
          'color',
        ].includes(input.type)
      ) {
        continue;
      }
      if (!input.dataset.exampleReady) {
        input.placeholder = example(input);
        input.dataset.exampleReady = 'true';
      }
    }
    const buttons = root.matches?.('button') ? [root] : root.querySelectorAll('button');
    for (const button of buttons) {
      if (
        /^(?:\+|Agregar\b|Añadir\b|Crear\b|Nuevo\b|Nueva\b|Registrar\b)/i.test(
          button.textContent.trim(),
        )
      ) {
        button.classList.add('app-add-action');
      }
    }
  }
  function init() {
    decorate(document);
    document.addEventListener('focusin', (event) => {
      const input = event.target,
        rule = policy(input);
      if (!rule) return;
      editing.set(input, {
        previous: input.value,
        replaceZero: rule.kind === 'number' && /^-?0+(?:[.,]0+)*$/.test(input.value),
      });
    });
    document.addEventListener(
      'beforeinput',
      (event) => {
        const input = event.target,
          rule = policy(input);
        if (
          !rule ||
          event.isComposing ||
          !event.inputType?.startsWith('insert') ||
          event.data == null
        ) {
          return;
        }
        const current = state(input),
          start = current.replaceZero ? 0 : (input.selectionStart ?? input.value.length),
          end = current.replaceZero ? input.value.length : (input.selectionEnd ?? start);
        const inserted =
          current.replaceZero && /^[.,]$/.test(event.data) ? `0${event.data}` : event.data;
        const next = input.value.slice(0, start) + inserted + input.value.slice(end);
        if (!rule.valid(next)) {
          event.preventDefault();
          return;
        }
        if (current.replaceZero) {
          if (input.type === 'number') {
            input.value = '';
            current.replaceZero = false;
            return;
          }
          event.preventDefault();
          input.value = next;
          current.replaceZero = false;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      },
      true,
    );
    document.addEventListener(
      'paste',
      (event) => {
        const input = event.target,
          rule = policy(input);
        if (!rule) return;
        const data = event.clipboardData?.getData('text');
        if (data == null) return;
        const current = state(input),
          start = current.replaceZero ? 0 : (input.selectionStart ?? 0),
          end = current.replaceZero
            ? input.value.length
            : (input.selectionEnd ?? input.value.length);
        const next = input.value.slice(0, start) + data + input.value.slice(end);
        if (!rule.valid(next)) event.preventDefault();
        else if (current.replaceZero) {
          event.preventDefault();
          input.value = next;
          current.replaceZero = false;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      },
      true,
    );
    document.addEventListener(
      'input',
      (event) => {
        if (!event.isComposing) {
          validateInput(event.target);
          const current = editing.get(event.target);
          if (current) current.replaceZero = false;
        }
      },
      true,
    );
    document.addEventListener('compositionend', (event) => validateInput(event.target), true);
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) if (node.nodeType === 1) decorate(node);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
