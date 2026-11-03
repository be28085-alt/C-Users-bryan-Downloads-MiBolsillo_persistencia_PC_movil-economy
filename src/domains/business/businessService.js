(function () {
  const businessService = {
    buildKpis(negocio, ventas, inventario, compras) {
      const ventasTotal = (ventas || []).reduce((sum, venta) => sum + Number(venta.total || 0), 0);
      const comprasTotal = (compras || []).reduce((sum, compra) => sum + Number(compra.total || 0), 0);
      const inventoryValue = (inventario || []).reduce((sum, item) => sum + Number(item.stock || 0) * Number(item.costoUnitario || 0), 0);

      return {
        negocioNombre: negocio?.nombre || 'Sin negocio',
        ventasTotales: ventasTotal,
        comprasTotales: comprasTotal,
        valorInventario: inventoryValue,
        utilidadEstimada: Math.max(ventasTotal - comprasTotal, 0),
        stockBajo: (inventario || []).filter(item => Number(item.stock || 0) <= Number(item.stockMinimo || 0)).length
      };
    }
  };

  window.MiBolsilloBusiness = window.MiBolsilloBusiness || {};
  window.MiBolsilloBusiness = Object.assign(window.MiBolsilloBusiness, businessService);
})();
