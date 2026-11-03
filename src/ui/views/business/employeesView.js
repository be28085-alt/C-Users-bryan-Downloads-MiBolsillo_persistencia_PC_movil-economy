/**
 * ============================================================================
 * BUSINESS EMPLOYEES VIEW
 * Responsabilidad: Personal del negocio, cargos, asignación salarial y nómina.
 * ============================================================================
 */
(function () {
  'use strict';

  const employeesView = {
    render(finanzas, negActivo) {
      if (!finanzas || !negActivo) return;

      const emps = finanzas.getEmpleados(negActivo.id);
      const pagos = finanzas.getPagosEmpleado(negActivo.id);

      // 1. Directorio de empleados
      const tbodyEmp = document.getElementById('bizTbodyEmpleados');
      if (tbodyEmp) {
        if (emps.length === 0) {
          tbodyEmp.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--pc-text-muted); padding: 2rem;">No hay empleados registrados en este negocio.</td></tr>`;
        } else {
          tbodyEmp.innerHTML = emps.map(e => `
            <tr>
              <td><strong>${window.escapeHTML(e.nombre)}</strong></td>
              <td>${window.escapeHTML(e.cargo)}</td>
              <td>${window.escapeHTML(e.telefono || 'Sin teléfono')}</td>
              <td><strong>${window.formatCOP(e.salario)}</strong></td>
              <td>${e.fechaIngreso}</td>
              <td><span class="biz-status-pill success"><span class="dot"></span> ${e.estado}</span></td>
              <td>
                <button class="btn-pc-secondary" style="font-size: 0.78rem;" onclick="pcApp.openModalPagoNomina('${e.id}')">Pagar</button>
              </td>
            </tr>
          `).join('');
        }
      }

      // 2. Historial de pagos de nómina
      const tbodyPagos = document.getElementById('bizTbodyPagosNomina');
      if (tbodyPagos) {
        if (pagos.length === 0) {
          tbodyPagos.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--pc-text-muted); padding: 1.5rem;">Sin pagos de nómina en el historial.</td></tr>`;
        } else {
          tbodyPagos.innerHTML = pagos.map(p => `
            <tr>
              <td><strong>${p.fecha}</strong></td>
              <td>${window.escapeHTML(p.empleadoNombre)}</td>
              <td>${window.escapeHTML(p.concepto)}</td>
              <td>${window.escapeHTML(p.periodo)}</td>
              <td style="font-weight: 700; color: #e11d48;">-${window.formatCOP(p.monto)}</td>
              <td>${window.escapeHTML(p.metodoPago)}</td>
            </tr>
          `).join('');
        }
      }
    }
  };

  window.BusinessEmployeesView = employeesView;
})();
