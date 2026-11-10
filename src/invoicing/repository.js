(function () {
  'use strict';
  // Repository contract: transact(syncMutator) commits the entire candidate snapshot or throws.
  // A future authenticated API implementation must enforce database transactions and unique keys server-side.
  class LocalInvoiceRepository extends window.BusinessRepository {}
  window.LocalInvoiceRepository = LocalInvoiceRepository;
})();
