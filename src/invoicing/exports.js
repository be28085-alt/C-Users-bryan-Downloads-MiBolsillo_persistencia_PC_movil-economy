(function () {
  'use strict';
  const escape = value => String(value ?? '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  const kindLabel = { INVOICE: 'Factura de venta simulada', CREDIT_NOTE: 'Nota crédito simulada', DEBIT_NOTE: 'Nota débito simulada' };
  function consultationUrl(doc) {
    const url = new URL(window.location.pathname, window.location.origin);
    url.searchParams.set('modulo', 'EMPRESARIAL'); url.searchParams.set('facturaSimulada', doc.id);
    return url.href;
  }
  function qr(doc) { const code = window.qrcode(0, 'M'); code.addData(consultationUrl(doc)); code.make(); return code; }
  function xml(doc, classification = 'EXPERIMENTAL') {
    if (classification !== 'EXPERIMENTAL') throw new Error('Exportación conforme deshabilitada: faltan XSD, reglas DIAN, firma y habilitación.');
    const root = { INVOICE: 'Invoice', CREDIT_NOTE: 'CreditNote', DEBIT_NOTE: 'DebitNote' }[doc.kind];
    const lineTag = { INVOICE: 'InvoiceLine', CREDIT_NOTE: 'CreditNoteLine', DEBIT_NOTE: 'DebitNoteLine' }[doc.kind];
    const qtyTag = { INVOICE: 'InvoicedQuantity', CREDIT_NOTE: 'CreditedQuantity', DEBIT_NOTE: 'DebitedQuantity' }[doc.kind];
    const cbc = (key, val, attributes = '') => `<cbc:${key}${attributes}>${escape(val)}</cbc:${key}>`;
    const money = (key, val) => cbc(key, val, ' currencyID="COP"');
    const scheme = kind => `<cac:TaxScheme>${cbc('ID', kind === 'INC' ? '04' : '01')}${cbc('Name', kind === 'INC' ? 'INC' : 'IVA')}</cac:TaxScheme>`;
    const taxSubtotal = t => `<cac:TaxSubtotal>${money('TaxableAmount', t.base)}${money('TaxAmount', t.amount)}<cac:TaxCategory>${cbc('Percent', t.rate)}${['EXENTO', 'EXCLUIDO'].includes(t.kind) ? cbc('TaxExemptionReason', t.kind) : ''}${scheme(t.kind)}</cac:TaxCategory></cac:TaxSubtotal>`;
    const party = (tag, p) => `<cac:${tag}><cac:Party><cac:PartyIdentification>${cbc('ID', p.document)}</cac:PartyIdentification><cac:PartyName>${cbc('Name', p.name)}</cac:PartyName><cac:PostalAddress>${cbc('StreetName', p.address)}<cac:Country>${cbc('IdentificationCode', 'CO')}</cac:Country></cac:PostalAddress><cac:Contact>${cbc('ElectronicMail', p.email)}</cac:Contact></cac:Party></cac:${tag}>`;
    const totalsTag = doc.kind === 'DEBIT_NOTE' ? 'RequestedMonetaryTotal' : 'LegalMonetaryTotal';
    return `<?xml version="1.0" encoding="UTF-8"?>\n<!-- EXPERIMENTAL: SIMULACIÓN SIN VALIDEZ FISCAL. Basado en UBL 2.1; referencia DIAN anexo 1.9. Sin validación XSD/DIAN, CUFE/CUDE, firma ni autorización. -->\n` +
      `<${root} xmlns="urn:oasis:names:specification:ubl:schema:xsd:${root}-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">` +
      cbc('UBLVersionID', '2.1') + cbc('CustomizationID', 'SIMULACION-EXPERIMENTAL') + cbc('ProfileID', 'CONSULTA INTERNA SIN VALIDEZ FISCAL') + cbc('ID', doc.number || doc.simulationId) + cbc('IssueDate', doc.date) +
      (doc.kind === 'INVOICE' ? cbc('InvoiceTypeCode', '01') : '') + cbc('Note', `SIMULACIÓN SIN VALIDEZ FISCAL | ${doc.simulationId} | ${doc.status} | ${doc.reason || doc.notes}`) + cbc('DocumentCurrencyCode', 'COP') +
      (doc.originalId ? `<cac:BillingReference><cac:InvoiceDocumentReference>${cbc('ID', doc.originalNumber)}</cac:InvoiceDocumentReference></cac:BillingReference>` : '') +
      party('AccountingSupplierParty', doc.supplier) + party('AccountingCustomerParty', doc.customer) +
      `<cac:PaymentMeans>${cbc('PaymentMeansCode', { Efectivo: '10', Transferencia: '42', Tarjeta: '48', Otro: 'ZZZ' }[doc.paymentMethod])}${cbc('PaymentDueDate', doc.dueDate)}</cac:PaymentMeans>` +
      `<cac:TaxTotal>${money('TaxAmount', doc.totals.tax)}${doc.totals.taxes.map(taxSubtotal).join('')}</cac:TaxTotal>` +
      `<cac:${totalsTag}>${money('LineExtensionAmount', doc.totals.base)}${money('TaxExclusiveAmount', doc.totals.base)}${money('TaxInclusiveAmount', doc.totals.total)}${money('PayableAmount', doc.totals.total)}</cac:${totalsTag}>` +
      doc.totals.lines.map((l, i) => `<cac:${lineTag}>${cbc('ID', i + 1)}${cbc(qtyTag, l.quantity, ' unitCode="C62"')}${money('LineExtensionAmount', l.base)}` +
        (l.discount !== '0.00' ? `<cac:AllowanceCharge>${cbc('ChargeIndicator', 'false')}${cbc('AllowanceChargeReason', 'Descuento comercial')}${money('Amount', l.discount)}${money('BaseAmount', l.gross)}</cac:AllowanceCharge>` : '') +
        `<cac:TaxTotal>${money('TaxAmount', l.tax)}${taxSubtotal({ kind: l.taxKind, rate: l.taxRate, base: l.base, amount: l.tax })}</cac:TaxTotal><cac:Item>${cbc('Description', `${l.description} [unidad interna: ${l.unit}]`)}</cac:Item><cac:Price>${money('PriceAmount', l.unitPrice)}</cac:Price></cac:${lineTag}>`).join('') + `</${root}>`;
  }
  function pdf(doc, options = {}) {
    const receipt = options.receipt === true;
    // Small dependency-free PDF writer. ISO-8859-1 text maps to Helvetica WinAnsi for Spanish.
    const clean = s => String(s ?? '').replace(/[\u2010-\u2015]/g, '-').replace(/[^\x20-\xff]/g, '?');
    const quote = s => clean(s).replace(/[\\()]/g, '\\$&');
    const wrap = (s, size) => {
      const words = clean(s).split(/\s+/), rows = []; let line = '';
      for (let word of words) { while (word.length > size) { if (line) { rows.push(line); line = ''; } rows.push(word.slice(0, size)); word = word.slice(size); } if ((line + ' ' + word).trim().length > size) { rows.push(line); line = word; } else line = (line + ' ' + word).trim(); }
      if (line) rows.push(line); return rows;
    };
    const pages = []; let commands, y;
    const drawText = (x, pos, content, size = 10, bold = false, color = '0.12 0.18 0.25') => commands.push(`${color} rg BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${pos} Td (${quote(content)}) Tj ET`);
    function page() {
      commands = []; pages.push(commands); y = 720;
      commands.push('0.06 0.14 0.22 rg 0 754 595 88 re f');
      drawText(38, 805, receipt ? 'Comprobante de venta' : kindLabel[doc.kind], 19, true, '1 1 1');
      drawText(38, 780, doc.number || 'BORRADOR', 12, true, '0.5 0.9 0.8');
      drawText(38, 740, receipt ? 'COMPROBANTE INTERNO SIN VALIDEZ FISCAL' : 'SIMULACIÓN SIN VALIDEZ FISCAL', 13, true, '0.68 0.22 0.08');
      drawText(38, 26, `Gestor Financiero | ${receipt ? 'Comprobante interno' : 'Simulación interna'} | Página ${pages.length}`, 9);
      drawText(38, 13, 'Sin CUFE/CUDE oficial, firma digital, numeración autorizada ni validación DIAN.', 8);
    }
    const need = height => { if (y - height < 55) page(); };
    function paragraph(s, bold = false) { for (const line of wrap(s, 88)) { need(16); drawText(38, y, line, 10, bold); y -= 15; } y -= 4; }
    page();
    paragraph(`Emisor: ${doc.supplier.name}`, true); paragraph(`Identificación: ${doc.supplier.document || 'No configurada'} | ${doc.supplier.address}`);
    paragraph(`Fecha: ${doc.date} | Vencimiento: ${doc.dueDate} | Estado: ${doc.status}`);
    paragraph(`Cliente: ${doc.customer.name}`, true); paragraph(`${doc.customer.documentType}: ${doc.customer.document} | ${doc.customer.email}`); paragraph(`Dirección: ${doc.customer.address} | Teléfono: ${doc.customer.phone}`);
    if (doc.originalNumber) paragraph(`Referencia: ${doc.originalNumber} | Motivo: ${doc.reason}`);
    y -= 8;
    function tableHeader() { need(30); commands.push(`0.9 0.94 0.95 rg 38 ${y - 7} 519 24 re f`); ['Artículo', 'Cantidad', 'Precio', 'Desc.', 'Imp.', 'Total COP'].forEach((t, i) => drawText([43, 238, 300, 366, 426, 490][i], y, t, 9, true)); y -= 28; }
    tableHeader();
    for (const l of doc.totals.lines) {
      const description = wrap(l.description, 32), height = Math.max(description.length * 13 + 20, 38);
      if (y - height < 55) { page(); tableHeader(); }
      description.forEach((s, i) => drawText(43, y - i * 13, s, Math.min(9, 185 / (s.length * 0.8))));
      [l.quantity.replace(/0+$/, '').replace(/\.$/, ''), l.unitPrice.replace(/00$/, ''), l.discount, l.tax, l.total].forEach((t, i) => drawText([238, 300, 366, 426, 490][i], y, t, Math.min(8, 54 / (t.length * 0.58))));
      y -= height; commands.push(`0.83 0.87 0.89 RG 38 ${y + 12} m 557 ${y + 12} l S`);
    }
    need(130); y -= 8;
    for (const [label, value] of [['Bruto', doc.totals.gross], ['Descuentos', doc.totals.discount], ['Base', doc.totals.base], ['Impuestos', doc.totals.tax], ['TOTAL COP', doc.totals.total]]) {
      drawText(345, y, label, 11, true); drawText(465, y, value, Math.min(11, 90 / (value.length * 0.6)), true); y -= 20;
    }
    paragraph(`Pago: ${doc.paymentTerms} | Medio: ${doc.paymentMethod}`);
    if (doc.notes) paragraph(`Observaciones: ${doc.notes}`);
    paragraph('Redondeo HALF_UP por línea a 2 decimales. Cantidades y precios hasta 4 decimales.');
    if (receipt) { paragraph(`Pagado COP: ${doc.paid} | Saldo pendiente COP: ${doc.balance}`, true); }
    else {
    need(165);
    const code = qr(doc), count = code.getModuleCount(), cell = 112 / (count + 8), left = 38, bottom = y - 125;
    commands.push(`1 1 1 rg ${left} ${bottom} 112 112 re f`, '0 0 0 rg');
    for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) if (code.isDark(row, col)) commands.push(`${(left + (col + 4) * cell).toFixed(3)} ${(bottom + (count - row + 3) * cell).toFixed(3)} ${(cell + 0.01).toFixed(3)} ${(cell + 0.01).toFixed(3)} re f`);
    drawText(165, y - 25, 'QR DE CONSULTA INTERNA', 11, true);
    drawText(165, y - 43, 'Requiere los datos locales y acceso al negocio.', 9);
    drawText(165, y - 60, 'No corresponde a validación oficial de la DIAN.', 9);
    wrap(doc.simulationId, 59).forEach((s, i) => drawText(165, y - 80 - i * 12, s, 8));
    }
    // Object offsets count single-byte characters. Return Uint8Array, not a UTF-8 encoded string.
    const objects = [null, '<< /Type /Catalog /Pages 2 0 R >>', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
    const kids = [];
    for (const content of pages) {
      const pageId = objects.length, streamId = pageId + 1; kids.push(`${pageId} 0 R`);
      objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`);
      const stream = content.join('\n'); objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    }
    objects[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
    let result = '%PDF-1.4\n', offsets = [0];
    for (let i = 1; i < objects.length; i++) { offsets.push(result.length); result += `${i} 0 obj\n${objects[i]}\nendobj\n`; }
    const start = result.length; result += `xref\n0 ${objects.length}\n0000000000 65535 f \n` + offsets.slice(1).map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('') + `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
    return Uint8Array.from(result, c => c.charCodeAt(0));
  }
  function download(doc, format) {
    const data = format === 'pdf' ? pdf(doc) : xml(doc);
    const url = URL.createObjectURL(new Blob([data], { type: format === 'pdf' ? 'application/pdf' : 'application/xml;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `${doc.number || doc.simulationId}-SIN-VALIDEZ-FISCAL.${format}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  window.InvoiceExports = { xml, pdf, qr, consultationUrl, download, kindLabel };
})();
