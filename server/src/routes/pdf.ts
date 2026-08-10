import PDFDocument from 'pdfkit';
import { Response } from 'express';

export interface ChallanPDFData {
  challanNumber: string;
  createdDate: string;
  status: string;
  customerName: string;
  customerMobile: string;
  customerAddress?: string;
  businessName?: string;
  gstNumber?: string;
  items: Array<{
    productName: string;
    sku: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }>;
  totalQuantity: number;
  totalAmount: number;
}

export function generateChallanPDF(data: ChallanPDFData, res: Response) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${data.challanNumber}.pdf"`);

  doc.pipe(res);

  // Header Banner
  doc.rect(0, 0, 595, 80).fill('#0f172a');
  doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold').text('VERVE ERP & CRM', 40, 25);
  doc.fontSize(10).font('Helvetica').text('SALES CHALLAN / TAX INVOICE', 40, 55);

  // Metadata Box Right Header
  doc.fillColor('#ffffff').fontSize(12).font('Helvetica-Bold').text(`NO: ${data.challanNumber}`, 380, 25, { align: 'right' });
  doc.fontSize(9).font('Helvetica').text(`Date: ${data.createdDate}`, 380, 42, { align: 'right' });
  doc.fontSize(9).font('Helvetica-Bold').text(`Status: ${data.status.toUpperCase()}`, 380, 56, { align: 'right' });

  // Customer Details Block
  doc.moveDown(3);
  doc.fillColor('#1e293b').fontSize(11).font('Helvetica-Bold').text('BILLED TO / DELIVERED TO:');
  doc.fontSize(10).font('Helvetica-Bold').text(data.customerName);
  if (data.businessName) doc.fontSize(9).font('Helvetica').text(`Business: ${data.businessName}`);
  doc.fontSize(9).font('Helvetica').text(`Phone: ${data.customerMobile}`);
  if (data.gstNumber) doc.fontSize(9).font('Helvetica').text(`GSTIN: ${data.gstNumber}`);
  if (data.customerAddress) doc.fontSize(9).font('Helvetica').text(`Address: ${data.customerAddress}`);

  doc.moveDown(1.5);

  // Table Headers
  const startY = doc.y;
  doc.rect(40, startY, 515, 22).fill('#f1f5f9');
  doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold');
  doc.text('#', 45, startY + 6);
  doc.text('Item Description', 70, startY + 6);
  doc.text('SKU', 260, startY + 6);
  doc.text('Price (INR)', 350, startY + 6, { width: 60, align: 'right' });
  doc.text('Qty', 420, startY + 6, { width: 40, align: 'right' });
  doc.text('Total (INR)', 470, startY + 6, { width: 80, align: 'right' });

  let currentY = startY + 28;

  // Items List
  doc.font('Helvetica').fontSize(9).fillColor('#0f172a');
  data.items.forEach((item, idx) => {
    if (idx % 2 === 1) {
      doc.rect(40, currentY - 4, 515, 20).fill('#f8fafc');
      doc.fillColor('#0f172a');
    }

    doc.text(String(idx + 1), 45, currentY);
    doc.text(item.productName, 70, currentY, { width: 180 });
    doc.text(item.sku, 260, currentY, { width: 80 });
    doc.text(`₹${Number(item.unitPrice).toLocaleString('en-IN')}`, 350, currentY, { width: 60, align: 'right' });
    doc.text(String(item.quantity), 420, currentY, { width: 40, align: 'right' });
    doc.text(`₹${Number(item.lineTotal).toLocaleString('en-IN')}`, 470, currentY, { width: 80, align: 'right' });

    currentY += 22;
  });

  doc.moveTo(40, currentY).lineTo(555, currentY).stroke('#e2e8f0');
  currentY += 10;

  // Totals Summary Box
  doc.rect(340, currentY, 215, 50).fill('#f8fafc').stroke('#cbd5e1');
  doc.fillColor('#334155').fontSize(10).font('Helvetica-Bold');
  doc.text(`Total Quantity:`, 350, currentY + 10);
  doc.text(`${data.totalQuantity}`, 470, currentY + 10, { width: 80, align: 'right' });

  doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a');
  doc.text(`Grand Total:`, 350, currentY + 28);
  doc.text(`₹${Number(data.totalAmount).toLocaleString('en-IN')}`, 470, currentY + 28, { width: 80, align: 'right' });

  // Footer / Terms
  doc.fontSize(8).font('Helvetica').fillColor('#64748b');
  doc.text('Thank you for your business!', 40, 780, { align: 'center' });
  doc.text('This is a computer-generated sales challan document.', 40, 792, { align: 'center' });

  doc.end();
}
