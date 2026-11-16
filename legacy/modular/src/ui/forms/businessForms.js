/**
 * ============================================================================
 * BUSINESS FORMS
 * Responsabilidad: Manejadores de submit y cálculos dinámicos de formularios de
 * Gestión Empresarial (Ventas, Compras, Producción, Nómina, etc.).
 * ============================================================================
 */
(function () {
  'use strict';

  const businessForms = {
    actualizarCalculoVenta() {
      const tbody = document.getElementById('bizVentaLineasTbody');
      if (!tbody) return;
      let total = 0;

      Array.from(tbody.children).forEach(tr => {
        const cant = Number(tr.querySelector('.inp-linea-cant')?.value) || 0;
        const precio = Number(tr.querySelector('.inp-linea-precio')?.value) || 0;
        const sub = cant * precio;
        total += sub;
        const lblSub = tr.querySelector('.lbl-linea-subtotal');
        if (lblSub) lblSub.textContent = `$ ${sub.toLocaleString('es-CO')} COP`;
      });

      const lblTotal = document.getElementById('bizVentaTotalCalculado');
      if (lblTotal) lblTotal.textContent = `$ ${total.toLocaleString('es-CO')} COP`;
    },

    actualizarCalculoCompra() {
      const tbody = document.getElementById('bizCompraLineasTbody');
      if (!tbody) return;
      let total = 0;

      Array.from(tbody.children).forEach(tr => {
        const cant = Number(tr.querySelector('.inp-linea-compra-cant')?.value) || 0;
        const precio = Number(tr.querySelector('.inp-linea-compra-precio')?.value) || 0;
        const sub = cant * precio;
        total += sub;
        const lblSub = tr.querySelector('.lbl-linea-compra-subtotal');
        if (lblSub) lblSub.textContent = `$ ${sub.toLocaleString('es-CO')} COP`;
      });

      const lblTotal = document.getElementById('bizCompraTotalCalculado');
      if (lblTotal) lblTotal.textContent = `$ ${total.toLocaleString('es-CO')} COP`;
    },

    handleNuevaVentaSubmit(e) {
      e.preventDefault();
      if (!window.Finanzas) return;

      const clienteSel = document.getElementById('bizVentaCliente');
      const clienteId = clienteSel.value || null;
      const clienteNombre = clienteSel.selectedOptions[0] ? clienteSel.selectedOptions[0].textContent.split(String.fromCharCode(40))[0].trim() : 'Cliente Mostrador';
      const tipoPago = document.getElementById('bizVentaTipoPago').value;
      const metodoPago = document.getElementById('bizVentaMetodoPago').value;
      const fecha = document.getElementById('bizVentaFecha').value;
      const notas = document.getElementById('bizVentaNotas').value;

      const tbody = document.getElementById('bizVentaLineasTbody');
      const detalles = [];

      Array.from(tbody.children).forEach(tr => {
        const selProd = tr.querySelector('.sel-linea-prod');
        const prodId = selProd.value;
        const cantidad = Number(tr.querySelector('.inp-linea-cant').value) || 0;
        const precio = Number(tr.querySelector('.inp-linea-precio').value) || 0;
        if (prodId && cantidad > 0) {
          detalles.push({
            productoId: prodId,
            cantidad,
            precioUnitario: precio
          });
        }
      });

      if (detalles.length === 0) {
        if (window.pcApp) window.pcApp.showToast('Debe agregar al menos un producto a la venta.', 'danger');
        return;
      }

      const res = window.Finanzas.registrarVenta({
        clienteId,
        clienteNombre,
        tipoPago,
        metodoPago,
        fecha,
        notas,
        detalles
      });

      if (res.error) {
        if (window.pcApp) window.pcApp.showToast(`Error: ${res.error}`, 'danger');
        return;
      }

      e.target.reset();
      window.BusinessModals.closeModalNuevaVenta();
      if (window.pcApp) {
        window.pcApp.renderBusinessModule();
        window.pcApp.showToast(`✓ Venta #${res.venta.id} registrada exitosamente.`);
      }
    },

    handleNuevaCompraSubmit(e) {
      e.preventDefault();
      if (!window.Finanzas) return;

      const provSel = document.getElementById('bizCompraProveedor');
      const provId = provSel.value || null;
      const provNombre = provSel.selectedOptions[0] ? provSel.selectedOptions[0].textContent.trim() : 'Proveedor General';
      const fecha = document.getElementById('bizCompraFecha').value;
      const obs = document.getElementById('bizCompraObs').value;

      const tbody = document.getElementById('bizCompraLineasTbody');
      const detalles = [];

      Array.from(tbody.children).forEach(tr => {
        const selProd = tr.querySelector('.sel-linea-compra-prod');
        const prodId = selProd.value;
        const cantidad = Number(tr.querySelector('.inp-linea-compra-cant').value) || 0;
        const precio = Number(tr.querySelector('.inp-linea-compra-precio').value) || 0;
        if (prodId && cantidad > 0) {
          detalles.push({
            productoId: prodId,
            cantidad,
            precioUnitario: precio
          });
        }
      });

      if (detalles.length === 0) {
        if (window.pcApp) window.pcApp.showToast('Debe agregar al menos un insumo a la orden de compra.', 'danger');
        return;
      }

      const res = window.Finanzas.registrarCompra({
        proveedorId: provId,
        proveedorNombre: provNombre,
        fecha,
        observaciones: obs,
        detalles
      });

      if (res.error) {
        if (window.pcApp) window.pcApp.showToast(`Error: ${res.error}`, 'danger');
        return;
      }

      e.target.reset();
      window.BusinessModals.closeModalNuevaCompra();
      if (window.pcApp) {
        window.pcApp.renderBusinessModule();
        window.pcApp.showToast(`✓ Compra registrada. Se aumentó el inventario de los productos comprados.`);
      }
    },

    handleNuevoProductoSubmit(e) {
      e.preventDefault();
      if (!window.Finanzas) return;

      const tipo = document.getElementById('bizInputProdTipo').value;
      const nombre = document.getElementById('bizInputProdNombre').value;
      const descripcion = document.getElementById('bizInputProdDesc').value;
      const precioVenta = document.getElementById('bizInputProdPrecioVenta').value;
      const costo = document.getElementById('bizInputProdCosto').value;
      const unidad = document.getElementById('bizInputProdUnidad').value;
      const stock = document.getElementById('bizInputProdStock').value;
      const stockMin = document.getElementById('bizInputProdStockMin').value;

      window.Finanzas.agregarProducto({
        tipo,
        nombre,
        descripcion,
        precioVenta: Number(precioVenta) || 0,
        costoUnitario: Number(costo) || 0,
        precioCompra: Number(costo) || 0,
        unidadMedida: unidad,
        stock: Number(stock) || 0,
        stockMinimo: Number(stockMin) || 0
      });

      e.target.reset();
      window.BusinessModals.closeModalNuevoProducto();
      if (window.pcApp) {
        window.pcApp.renderBusinessModule();
        window.pcApp.showToast(`✓ ${tipo === 'MATERIA_PRIMA' ? 'Materia prima' : 'Producto'} registrado con éxito.`);
      }
    },

    handleNuevoProveedorSubmit(e) {
      e.preventDefault();
      if (!window.Finanzas) return;

      const nombre = document.getElementById('bizInputProvNombre').value;
      const tel = document.getElementById('bizInputProvTel').value;
      const email = document.getElementById('bizInputProvEmail').value;
      const dir = document.getElementById('bizInputProvDir').value;

      window.Finanzas.agregarProveedor({
        nombre,
        telefono: tel,
        email,
        direccion: dir
      });

      e.target.reset();
      window.BusinessModals.closeModalNuevoProveedor();
      if (window.pcApp) {
        window.pcApp.renderBusinessModule();
        window.pcApp.showToast('✓ Proveedor agregado al directorio.');
      }
    },

    handleNuevoClienteSubmit(e) {
      e.preventDefault();
      if (!window.Finanzas) return;

      const nombre = document.getElementById('bizInputCliNombre').value;
      const tel = document.getElementById('bizInputCliTel').value;
      const email = document.getElementById('bizInputCliEmail').value;
      const dir = document.getElementById('bizInputCliDir').value;

      window.Finanzas.agregarCliente({
        nombre,
        telefono: tel,
        email,
        direccion: dir
      });

      e.target.reset();
      window.BusinessModals.closeModalNuevoCliente();
      if (window.pcApp) {
        window.pcApp.renderBusinessModule();
        window.pcApp.showToast('✓ Cliente registrado exitosamente.');
      }
    },

    handleAbonoClienteSubmit(e) {
      e.preventDefault();
      if (!window.Finanzas) return;

      const ventaId = document.getElementById('modalAbonoVentaId').value;
      const clienteId = document.getElementById('modalAbonoClienteId').value;
      const monto = document.getElementById('modalAbonoMonto').value;
      const metodo = document.getElementById('modalAbonoMetodo').value;
      const notas = document.getElementById('modalAbonoNotas').value;

      if (!window.esMontoValido(monto)) {
        if (window.pcApp) window.pcApp.showToast('El monto del abono debe ser mayor a cero.', 'danger');
        return;
      }

      const res = window.Finanzas.registrarAbonoCliente(ventaId, clienteId, Number(monto), metodo, notas);
      if (res.error) {
        if (window.pcApp) window.pcApp.showToast(`Error: ${res.error}`, 'danger');
        return;
      }

      e.target.reset();
      window.BusinessModals.closeModalAbonoCliente();
      if (window.pcApp) {
        window.pcApp.renderBusinessModule();
        window.pcApp.showToast('✓ Abono aplicado correctamente. Se redujo el saldo adeudado.');
      }
    },

    handleRegistrarProduccionSubmit(e) {
      e.preventDefault();
      if (!window.Finanzas) return;

      const formulaId = document.getElementById('bizProdFormulaId').value;
      const cantidad = document.getElementById('bizProdCantidad').value;
      const notas = document.getElementById('bizProdNotas').value;

      if (!formulaId) {
        if (window.pcApp) window.pcApp.showToast('Seleccione una fórmula de producción.', 'danger');
        return;
      }
      if (!window.esMontoValido(cantidad)) {
        if (window.pcApp) window.pcApp.showToast('La cantidad debe ser mayor a cero.', 'danger');
        return;
      }

      const res = window.Finanzas.registrarProduccion(formulaId, Number(cantidad), notas);
      if (res.error) {
        if (window.pcApp) window.pcApp.showToast(`Error en producción: ${res.error}`, 'danger');
        return;
      }

      e.target.reset();
      window.BusinessModals.closeModalRegistrarProduccion();
      if (window.pcApp) {
        window.pcApp.renderBusinessModule();
        window.pcApp.showToast('✓ Lote fabricado exitosamente. Se descontaron materias primas y aumentaron productos terminados.');
      }
    },

    handleNuevoEmpleadoSubmit(e) {
      e.preventDefault();
      if (!window.Finanzas) return;

      const nombre = document.getElementById('bizInputEmpNombre').value;
      const cargo = document.getElementById('bizInputEmpCargo').value;
      const tel = document.getElementById('bizInputEmpTel').value;
      const salario = document.getElementById('bizInputEmpSalario').value;
      const fecha = document.getElementById('bizInputEmpFecha').value;

      window.Finanzas.agregarEmpleado({
        nombre,
        cargo,
        telefono: tel,
        salario: Number(salario) || 0,
        fechaIngreso: fecha
      });

      e.target.reset();
      window.BusinessModals.closeModalNuevoEmpleado();
      if (window.pcApp) {
        window.pcApp.renderBusinessModule();
        window.pcApp.showToast('✓ Empleado registrado en nómina.');
      }
    },

    handlePagoNominaSubmit(e) {
      e.preventDefault();
      if (!window.Finanzas) return;

      const empId = document.getElementById('bizNominaEmpleadoId').value;
      const monto = document.getElementById('bizNominaMonto').value;
      const concepto = document.getElementById('bizNominaConcepto').value;
      const periodo = document.getElementById('bizNominaPeriodo').value;
      const metodo = document.getElementById('bizNominaMetodo').value;

      if (!empId) {
        if (window.pcApp) window.pcApp.showToast('Seleccione el empleado a liquidar.', 'danger');
        return;
      }
      if (!window.esMontoValido(monto)) {
        if (window.pcApp) window.pcApp.showToast('El monto liquidado debe ser mayor a cero.', 'danger');
        return;
      }

      window.Finanzas.registrarPagoNomina(empId, Number(monto), concepto, periodo, metodo);
      e.target.reset();
      window.BusinessModals.closeModalPagoNomina();
      if (window.pcApp) {
        window.pcApp.renderBusinessModule();
        window.pcApp.showToast('✓ Comprobante de nómina generado.');
      }
    },

    handleNuevoGastoSubmit(e) {
      e.preventDefault();
      if (!window.Finanzas) return;

      const cat = document.getElementById('bizGastoCategoria').value;
      const monto = document.getElementById('bizGastoMonto').value;
      const fecha = document.getElementById('bizGastoFecha').value;
      const desc = document.getElementById('bizGastoDesc').value;

      if (!window.esMontoValido(monto)) {
        if (window.pcApp) window.pcApp.showToast('El valor del gasto debe ser mayor a cero.', 'danger');
        return;
      }

      window.Finanzas.registrarGastoNegocio({
        categoria: cat,
        monto: Number(monto),
        fecha,
        descripcion: desc
      });

      e.target.reset();
      window.BusinessModals.closeModalNuevoGasto();
      if (window.pcApp) {
        window.pcApp.renderBusinessModule();
        window.pcApp.showToast('✓ Gasto operativo registrado.');
      }
    },

    handleNuevoNegocioSubmit(e) {
      e.preventDefault();
      if (!window.Finanzas) return;

      const nombre = document.getElementById('inputNuevoBizNombre').value;
      const tipo = document.getElementById('inputNuevoBizTipo').value;
      const desc = document.getElementById('inputNuevoBizDesc').value;

      const n = window.Finanzas.agregarNegocio({
        nombre,
        tipo,
        descripcion: desc
      });

      e.target.reset();
      window.BusinessModals.closeModalNuevoNegocio();
      if (window.pcApp) {
        window.pcApp.renderBusinessModule();
        window.pcApp.showToast(`✓ Negocio "${n.nombre}" creado y activado.`);
      }
    },

    handleGuardarNegocioActivo(e) {
      e.preventDefault();
      if (!window.Finanzas) return;
      const activo = window.Finanzas.getNegocioActivo();
      if (!activo) return;

      window.Finanzas.actualizarNegocio(activo.id, {
        nombre: document.getElementById('inputBizNombre').value,
        tipo: document.getElementById('inputBizTipo').value,
        descripcion: document.getElementById('inputBizDescripcion').value,
        telefono: document.getElementById('inputBizTelefono').value,
        email: document.getElementById('inputBizEmail').value,
        direccion: document.getElementById('inputBizDireccion').value
      });

      if (window.pcApp) {
        window.pcApp.renderBusinessModule();
        window.pcApp.showToast('✓ Datos de la empresa guardados con éxito.');
      }
    }
  };

  window.BusinessForms = businessForms;
})();
