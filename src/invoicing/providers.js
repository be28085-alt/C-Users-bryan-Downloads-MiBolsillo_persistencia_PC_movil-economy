(function () {
  'use strict';
  // Provider contract: validate(document) -> { accepted:boolean, source:'INTERNAL_SIMULATION', errors:string[] }.
  // No provider may book inventory, payments or sales. The engine owns posting.
  class MockDianProvider {
    async validate(document) {
      const errors = [];
      if (!document.customer.address) errors.push('La validación interna requiere dirección del cliente.');
      if (!document.customer.email) errors.push('La validación interna requiere correo del cliente.');
      return { accepted: errors.length === 0, source: 'INTERNAL_SIMULATION', errors, provider: 'MockDianProvider' };
    }
  }
  class RealDianProvider {
    constructor(environment = 'disabled') {
      if (!['disabled', 'habilitation', 'production'].includes(environment)) throw new Error('Ambiente desconocido.');
      this.environment = environment;
    }
    async validate() {
      throw new Error('Integración DIAN deshabilitada: requiere backend, habilitación, numeración autorizada, CUFE/CUDE, firma y pruebas oficiales.');
    }
  }
  window.MockDianProvider = MockDianProvider;
  window.RealDianProvider = RealDianProvider;
})();
