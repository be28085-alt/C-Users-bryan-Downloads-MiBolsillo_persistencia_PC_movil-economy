/**
 * ============================================================================
 * BUSINESS MODALS
 * Responsabilidad: Apertura, población y gestión de modales del Módulo Empresarial.
 * ============================================================================
 */
(function () {
  'use strict';

  const businessModals = {
    // Venta
    openModalNuevaVenta() {
      this.poblarClientesVenta();
      this.resetLineasVenta();
      const dateEl = document.getElementById('bizVentaFecha');
      if (dateEl) dateEl.value = window.obtenerFechaHoyISO ? window.obtenerFechaHoyISO() : new Date().toISOString().split('T')[0];
      window.FinanzasModalManager.openModal('modalBizNuevaVenta');
    },

    closeModalNuevaVenta() {
      window.FinanzasModalManager.closeModal('modalBizNuevaVenta');
    },

    poblarClientesVenta() {
      const sel = document.getElementById('bizVentaCliente');
      if (!sel || !window.Finanzas) return;
      const clientes = window.Finanzas.getClientes();
      sel.innerHTML = '<option value="">-- Cliente Mostrador (General) --</option>' +
        clientes.map(c => `<option value="${c.id}">${window.escapeHTML(c.nombre)} (Saldo: $${(c.saldoPendiente || 0).toLocaleString('es-CO')})</option>`).join('');
    },

    resetLineasVenta() {
      const tbody = document.getElementById('bizVentaLineasTbody');
      if (!tbody) return;
      tbody.innerHTML = '';
      this.agregarLineaVenta();
    },

    agregarLineaVenta() {
      const tbody = document.getElementById('bizVentaLineasTbody');
      if (!tbody || !window.Finanzas) return;
      const prods = window.Finanzas.getProductos(null, 'PRODUCTO');
      const idx = tbody.children.length;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <select class="pc-select sel-linea-prod" onchange="pcApp.actualizarCalculoVenta()" required>
            <option value="">Seleccione producto...</option>
            ${prods.map(p => `<option value="${p.id}" data-precio="${p.precioVenta}" data-stock="${p.stock}">${window.escapeHTML(p.nombre)} (Stock: ${p.stock} | $${p.precioVenta.toLocaleString('es-CO')})</option>`).join('')}
          </select>
        </td>
        <td>
          <input type="number" class="pc-input inp-linea-cant" min="1" value="1" oninput="pcApp.actualizarCalculoVenta()" required style="width: 80px;">
        </td>
        <td>
          <input type="number" class="pc-input inp-linea-precio" min="0" value="0" oninput="pcApp.actualizarCalculoVenta()" required style="width: 110px;">
        </td>
        <td class="lbl-linea-subtotal" style="font-weight: 700;">$ 0 COP</td>
        <td>
          <button type="button" class="btn-pc-secondary" style="color: var(--pc-red); padding: 0.2rem 0.5rem;" onclick="this.closest('tr').remove(); pcApp.actualizarCalculoVenta();">✕</button>
        </td>
      `;
      tbody.appendChild(tr);

      // Auto-seleccionar precio
      const sel = tr.querySelector('.sel-linea-prod');
      const inpPrecio = tr.querySelector('.inp-linea-precio');
      sel.addEventListener('change', () => {
        const opt = sel.selectedOptions[0];
        if (opt && opt.dataset.precio) {
          inpPrecio.value = opt.dataset.precio;
          if (window.pcApp && typeof window.pcApp.actualizarCalculoVenta === 'function') {
            window.pcApp.actualizarCalculoVenta();
          }
        }
      });
    },

    // Compra
    openModalNuevaCompra() {
      this.poblarProveedoresCompra();
      this.resetLineasCompra();
      const dateEl = document.getElementById('bizCompraFecha');
      if (dateEl) dateEl.value = window.obtenerFechaHoyISO ? window.obtenerFechaHoyISO() : new Date().toISOString().split('T')[0];
      window.FinanzasModalManager.openModal('modalBizNuevaCompra');
    },

    closeModalNuevaCompra() {
      window.FinanzasModalManager.closeModal('modalBizNuevaCompra');
    },

    poblarProveedoresCompra() {
      const sel = document.getElementById('bizCompraProveedor');
      if (!sel || !window.Finanzas) return;
      const provs = window.Finanzas.getProveedores();
      sel.innerHTML = '<option value="">-- Seleccionar Proveedor --</option>' +
        provs.map(p => `<option value="${p.id}">${window.escapeHTML(p.nombre)}</option>`).join('');
    },

    resetLineasCompra() {
      const tbody = document.getElementById('bizCompraLineasTbody');
      if (!tbody) return;
      tbody.innerHTML = '';
      this.agregarLineaCompra();
    },

    agregarLineaCompra() {
      const tbody = document.getElementById('bizCompraLineasTbody');
      if (!tbody || !window.Finanzas) return;
      const items = window.Finanzas.getProductos(null, 'ALL');

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <select class="pc-select sel-linea-compra-prod" onchange="pcApp.actualizarCalculoCompra()" required>
            <option value="">Seleccione insumo o producto...</option>
            ${items.map(p => `<option value="${p.id}" data-costo="${p.costoUnitario || p.precioCompra}">${window.escapeHTML(p.nombre)} (${p.tipo === 'MATERIA_PRIMA' ? 'Materia Prima' : 'Producto'} - Actual: $${(p.costoUnitario || 0).toLocaleString('es-CO')})</option>`).join('')}
          </select>
        </td>
        <td>
          <input type="number" class="pc-input inp-linea-compra-cant" min="1" value="1" oninput="pcApp.actualizarCalculoCompra()" required style="width: 80px;">
        </td>
        <td>
          <input type="number" class="pc-input inp-linea-compra-precio" min="0" value="0" oninput="pcApp.actualizarCalculoCompra()" required style="width: 110px;">
        </td>
        <td class="lbl-linea-compra-subtotal" style="font-weight: 700;">$ 0 COP</td>
        <td>
          <button type="button" class="btn-pc-secondary" style="color: var(--pc-red); padding: 0.2rem 0.5rem;" onclick="this.closest('tr').remove(); pcApp.actualizarCalculoCompra();">✕</button>
        </td>
      `;
      tbody.appendChild(tr);

      const sel = tr.querySelector('.sel-linea-compra-prod');
      const inpPrecio = tr.querySelector('.inp-linea-compra-precio');
      sel.addEventListener('change', () => {
        const opt = sel.selectedOptions[0];
        if (opt && opt.dataset.costo) {
          inpPrecio.value = opt.dataset.costo;
          if (window.pcApp && typeof window.pcApp.actualizarCalculoCompra === 'function') {
            window.pcApp.actualizarCalculoCompra();
          }
        }
      });
    },

    // Producto
    openModalNuevoProducto(tipoDefecto = 'PRODUCTO') {
      const selTipo = document.getElementById('bizInputProdTipo');
      if (selTipo) selTipo.value = tipoDefecto;
      window.FinanzasModalManager.openModal('modalBizNuevoProducto');
    },

    closeModalNuevoProducto() {
      window.FinanzasModalManager.closeModal('modalBizNuevoProducto');
    },

    // Proveedor
    openModalNuevoProveedor() {
      window.FinanzasModalManager.openModal('modalBizNuevoProveedor');
    },

    closeModalNuevoProveedor() {
      window.FinanzasModalManager.closeModal('modalBizNuevoProveedor');
    },

    // Cliente
    openModalNuevoCliente() {
      window.FinanzasModalManager.openModal('modalBizNuevoCliente');
    },

    closeModalNuevoCliente() {
      window.FinanzasModalManager.closeModal('modalBizNuevoCliente');
    },

    // Abono
    openModalAbonoCliente(ventaId, clienteId) {
      const inputV = document.getElementById('modalAbonoVentaId');
      const inputC = document.getElementById('modalAbonoClienteId');
      const lblInfo = document.getElementById('modalAbonoInfoFactura');
      if (inputV) inputV.value = ventaId;
      if (inputC) inputC.value = clienteId;

      if (lblInfo && window.Finanzas) {
        const venta = (window.Finanzas.state.ventas || []).find(v => v.id === ventaId);
        if (venta) {
          lblInfo.textContent = `Factura #${venta.id} · Cliente: ${venta.clienteNombre} · Saldo Pendiente: $${(venta.saldoPendiente || 0).toLocaleString('es-CO')} COP`;
        }
      }
      window.FinanzasModalManager.openModal('modalBizAbonoCliente');
    },

    closeModalAbonoCliente() {
      window.FinanzasModalManager.closeModal('modalBizAbonoCliente');
    },

    // Producción
    openModalRegistrarProduccion() {
      const sel = document.getElementById('bizProdFormulaId');
      if (sel && window.Finanzas) {
        const formulas = window.Finanzas.getFormulas();
        sel.innerHTML = '<option value="">-- Seleccione receta/fórmula --</option>' +
          formulas.map(f => `<option value="${f.id}">${window.escapeHTML(f.nombre)} (Base: ${f.cantidadBase} uds)</option>`).join('');
      }
      window.FinanzasModalManager.openModal('modalBizRegistrarProduccion');
    },

    closeModalRegistrarProduccion() {
      window.FinanzasModalManager.closeModal('modalBizRegistrarProduccion');
    },

    // Empleados y Nómina
    openModalNuevoEmpleado() {
      window.FinanzasModalManager.openModal('modalBizNuevoEmpleado');
    },

    closeModalNuevoEmpleado() {
      window.FinanzasModalManager.closeModal('modalBizNuevoEmpleado');
    },

    openModalPagoNomina() {
      const sel = document.getElementById('bizNominaEmpleadoId');
      if (sel && window.Finanzas) {
        const emps = window.Finanzas.getEmpleados();
        sel.innerHTML = '<option value="">-- Seleccione empleado --</option>' +
          emps.map(e => `<option value="${e.id}" data-salario="${e.salario}">${window.escapeHTML(e.nombre)} (${e.cargo} - Salario: $${e.salario.toLocaleString('es-CO')})</option>`).join('');
      }
      window.FinanzasModalManager.openModal('modalBizPagoNomina');
    },

    closeModalPagoNomina() {
      window.FinanzasModalManager.closeModal('modalBizPagoNomina');
    },

    // Gasto Negocio
    openModalNuevoGasto() {
      window.FinanzasModalManager.openModal('modalBizNuevoGasto');
    },

    closeModalNuevoGasto() {
      window.FinanzasModalManager.closeModal('modalBizNuevoGasto');
    },

    // Negocio
    openModalNuevoNegocio() {
      window.FinanzasModalManager.openModal('modalBizNuevoNegocio');
    },

    closeModalNuevoNegocio() {
      window.FinanzasModalManager.closeModal('modalBizNuevoNegocio');
    }
  };

  window.BusinessModals = businessModals;
})();
