(function () {
  function clone(value) {
    if (value === null || value === undefined) return value;
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(value);
      } catch (error) {
        // Fall back to JSON clone for older browsers
      }
    }

    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return value;
    }
  }

  function normalizeState(state, fallback = {}) {
    const source = state && typeof state === 'object' && !Array.isArray(state) ? state : {};
    const base = fallback && typeof fallback === 'object' && !Array.isArray(fallback) ? fallback : {};

    return {
      ...clone(base),
      ...clone(source),
      usuario: {
        ...(base.usuario || {}),
        ...(source.usuario || {})
      },
      limitesCategorias: {
        ...(base.limitesCategorias || {}),
        ...(source.limitesCategorias || {})
      }
    };
  }

  const migrations = {
    FINANZAS_V1: (state) => {
      const normalized = normalizeState(state || {});
      if (typeof normalized.saldoInicial === 'undefined' && typeof normalized.capitalBase !== 'undefined') {
        normalized.saldoInicial = Number(normalized.capitalBase) || 0;
      }
      normalized.version = 'FINANZAS_V1';
      return normalized;
    },

    FINANZAS_V2: (state) => {
      const normalized = normalizeState(state || {});
      normalized.version = 'FINANZAS_V2';
      return normalized;
    }
  };

  function applyMigrations(rawState, fallbackState = {}) {
    const source = rawState && typeof rawState === 'object' && !Array.isArray(rawState) ? rawState : {};
    const base = fallbackState && typeof fallbackState === 'object' ? fallbackState : {};
    const version = typeof source.version === 'string' && source.version ? source.version : 'FINANZAS_V1';
    const order = ['FINANZAS_V1', 'FINANZAS_V2'];
    const startIndex = order.indexOf(version);

    let migrated = normalizeState(source, base);

    if (startIndex === -1) {
      migrated = migrations.FINANZAS_V1(migrated);
    } else {
      for (let i = startIndex; i < order.length; i += 1) {
        const migrationName = order[i];
        if (typeof migrations[migrationName] === 'function') {
          migrated = migrations[migrationName](migrated);
        }
      }
    }

    if (window.BusinessSchema) window.BusinessSchema.migrate(migrated);
    if (Array.isArray(migrated.negocios) && !migrated.negocios.some(n => n.id === migrated.negocioActivoId)) migrated.negocioActivoId = migrated.negocios[0]?.id || null;
    return migrated;
  }

  window.MiBolsilloMigrations = window.MiBolsilloMigrations || {};
  window.MiBolsilloMigrations = Object.assign(window.MiBolsilloMigrations, {
    versions: ['FINANZAS_V1', 'FINANZAS_V2'],
    migrations,
    applyMigrations
  });
})();
