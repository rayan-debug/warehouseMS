const PDFDocument = require('pdfkit');

function buildDocument(res, filename) {
  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);
  return doc;
}

function generateInvoicePdf(res, sale) {
  const doc = buildDocument(res, `invoice-${sale.id}.pdf`);
  doc.fontSize(20).text('WarehouseMS Invoice', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Invoice #: ${sale.id}`);
  doc.text(`Staff: ${sale.user_name}`);
  doc.text(`Date: ${new Date(sale.created_at).toLocaleString()}`);
  doc.text(`Notes: ${sale.notes || '-'}`);
  doc.moveDown();
  doc.fontSize(14).text('Items');
  sale.items.forEach((item) => {
    doc.fontSize(11).text(`${item.product_name} x${item.quantity} @ $${Number(item.price_at_sale).toFixed(2)}`);
  });
  doc.moveDown();
  doc.fontSize(13).text(`Total: $${Number(sale.total_amount).toFixed(2)}`, { align: 'right' });
  doc.end();
}

function generateSalesReportPdf(res, { stats, sales, products }) {
  const doc = buildDocument(res, 'monthly-sales-report.pdf');
  doc.fontSize(20).text('WarehouseMS Monthly Sales Report', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Total products: ${stats.totalProducts}`);
  doc.text(`Low stock items: ${stats.lowStock}`);
  doc.text(`Today revenue: $${stats.todayRevenue.toFixed(2)}`);
  doc.text(`Monthly revenue: $${stats.monthRevenue.toFixed(2)}`);
  doc.moveDown();
  doc.fontSize(14).text('Top products');
  products.slice(0, 5).forEach((product) => {
    doc.fontSize(11).text(`${product.name} — ${product.quantity} units`);
  });
  doc.moveDown();
  doc.fontSize(14).text('Recent sales');
  sales.slice(0, 10).forEach((sale) => {
    doc.fontSize(11).text(`#${sale.id} | ${sale.user_name} | $${Number(sale.total_amount).toFixed(2)} | ${new Date(sale.created_at).toLocaleDateString()}`);
  });
  doc.end();
}

module.exports = {
  generateInvoicePdf,
  generateSalesReportPdf,
};
