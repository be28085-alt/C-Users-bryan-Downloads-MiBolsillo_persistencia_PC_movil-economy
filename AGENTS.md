# Working rules for this project

- Implement and verify user-facing changes in both PC (`desktop.html`) and mobile (`mobile.html`). Keep equivalent features and financial results in both versions.
- The active controllers are `src/utils/desktop.js` and `src/utils/mobile.js`. The root JavaScript files and Qt application are independent legacy implementations.
- Prefer shared domain and view modules for features used by both interfaces. Preserve the separation between Finanzas Personales and Mi Negocio.
- Run `node --test tests/*.test.cjs`, `node test_shared.js` and `node test_dates.js` for changes to financial logic. For interface changes, also verify the affected flow in PC and mobile.
