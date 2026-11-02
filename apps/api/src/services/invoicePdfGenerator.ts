import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface InvoicePdfOptions {
  invoiceNumber: string;
  clientId?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  projectTitle: string;
  milestoneTitle?: string;
  amount: number;
  totalProjectCost?: number;
  paymentMode?: string;
  transactionRef?: string;
  issueDate?: string;
  paymentDate?: string;
  isFullPayment?: boolean;
  status?: string;
  notes?: string;
}

/**
 * Generates an official, beautifully branded vector PDF Tax Invoice
 * matching InfoHQ Command Center design specification.
 */
export async function generateInvoicePdf(data: InvoicePdfOptions): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  // Standard A4 dimensions: 595.28 x 841.89 points
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Exact Brand Colors from CRM_design.md
  const colorNavy = rgb(26 / 255, 8 / 255, 92 / 255);       // #1A085C (Headings)
  const colorPurple = rgb(124 / 255, 92 / 255, 232 / 255);   // #7C5CE8 (HQ Signature)
  const colorViolet = rgb(91 / 255, 76 / 255, 245 / 255);    // #5B4CF5 (Action Brand)
  const colorBody = rgb(75 / 255, 85 / 255, 99 / 255);       // #4B5563 (Body Text)
  const colorMuted = rgb(107 / 255, 114 / 255, 128 / 255);   // #6B7280 (Muted Labels)
  const colorBorder = rgb(234 / 255, 230 / 255, 247 / 255);  // #EAE6F7 (Card Borders)
  const colorBgLight = rgb(248 / 255, 248 / 255, 255 / 255); // #F8F8FF (Light Tint)
  const colorSuccess = rgb(22 / 255, 163 / 255, 74 / 255);   // #16A34A (Paid Stamp)
  const colorWhite = rgb(1, 1, 1);

  let y = height - 52;

  // 1. Header: InfoHQ Pvt Ltd
  page.drawText('Info', { x: 50, y, size: 24, font: fontBold, color: colorNavy });
  const infoWidth = fontBold.widthOfTextAtSize('Info', 24);
  page.drawText('HQ', { x: 50 + infoWidth, y, size: 24, font: fontBold, color: colorPurple });
  const hqWidth = fontBold.widthOfTextAtSize('HQ', 24);
  page.drawText(' Pvt Ltd', { x: 50 + infoWidth + hqWidth, y, size: 18, font: fontBold, color: colorNavy });

  y -= 18;
  page.drawText('Engineering Studio for AI, SaaS & Digital Systems', {
    x: 50,
    y,
    size: 10,
    font: fontRegular,
    color: colorMuted,
  });

  y -= 22;
  // Hairline Divider
  page.drawLine({
    start: { x: 50, y },
    end: { x: width - 50, y },
    thickness: 1,
    color: colorBorder,
  });

  y -= 34;
  // INVOICE Title (as requested: "jo capital me tax invoice likha h usko sirf invoice rakhho")
  page.drawText('INVOICE', { x: 50, y, size: 22, font: fontBold, color: colorNavy });

  y -= 22;
  // Invoice Number Badge
  const invNumberText = data.invoiceNumber || 'INV-2026-653';
  page.drawText(`Invoice No.   ${invNumberText}`, {
    x: 50,
    y,
    size: 11,
    font: fontBold,
    color: colorViolet,
  });

  // Top Right Metadata Column
  const rightX = 350;
  let metaY = y + 22;

  const drawMetaRow = (label: string, val: string) => {
    page.drawText(label, { x: rightX, y: metaY, size: 9.5, font: fontRegular, color: colorMuted });
    page.drawText(':', { x: rightX + 85, y: metaY, size: 9.5, font: fontRegular, color: colorMuted });
    page.drawText(val, { x: rightX + 95, y: metaY, size: 9.5, font: fontBold, color: colorNavy });
    metaY -= 15;
  };

  const clientIdText = data.clientId || 'CLT-2026';
  const issueDateText = data.issueDate || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const paymentDateText = data.paymentDate || issueDateText;
  const paymentModeText = data.paymentMode || 'UPI / Online';
  const txRefText = data.transactionRef || 'Direct Settlement';

  drawMetaRow('Client ID', clientIdText);
  drawMetaRow('Issue Date', issueDateText);
  drawMetaRow('Payment Date', paymentDateText);
  drawMetaRow('Payment Mode', paymentModeText);
  drawMetaRow('Transaction Ref.', txRefText);

  y -= 38;
  // Bill To Box (Left Column)
  page.drawText('Bill To', { x: 50, y, size: 9.5, font: fontBold, color: colorMuted });
  y -= 15;
  page.drawText(data.clientName || 'Valued Client', { x: 50, y, size: 14, font: fontBold, color: colorNavy });
  y -= 14;
  if (data.clientEmail) {
    page.drawText(data.clientEmail, { x: 50, y, size: 9.5, font: fontRegular, color: colorBody });
    y -= 13;
  }
  if (data.clientPhone) {
    page.drawText(data.clientPhone, { x: 50, y, size: 9.5, font: fontRegular, color: colorBody });
    y -= 13;
  }
  page.drawText(`Account ID:  ${clientIdText}`, { x: 50, y, size: 9, font: fontBold, color: colorViolet });

  y -= 32;
  // Items Table
  const tableX = 50;
  const tableW = width - 100;

  // Table Header Bar (Brand Violet)
  page.drawRectangle({
    x: tableX,
    y: y - 6,
    width: tableW,
    height: 24,
    color: colorViolet,
  });

  page.drawText('#', { x: tableX + 12, y, size: 9, font: fontBold, color: colorWhite });
  page.drawText('Description', { x: tableX + 45, y, size: 9, font: fontBold, color: colorWhite });
  page.drawText('Qty', { x: tableX + 325, y, size: 9, font: fontBold, color: colorWhite });
  page.drawText('Unit Price', { x: tableX + 375, y, size: 9, font: fontBold, color: colorWhite });
  page.drawText('Amount', { x: tableX + 440, y, size: 9, font: fontBold, color: colorWhite });

  y -= 28;
  // Table Row 1
  page.drawText('1', { x: tableX + 12, y, size: 9.5, font: fontRegular, color: colorBody });

  const milestoneClean = (data.milestoneTitle || 'Milestone Delivery').trim();
  const descString = `${milestoneClean}: ${data.projectTitle || 'System Implementation'}`;
  page.drawText(descString.length > 46 ? descString.substring(0, 44) + '...' : descString, {
    x: tableX + 45,
    y,
    size: 9.5,
    font: fontBold,
    color: colorNavy,
  });

  page.drawText('1', { x: tableX + 330, y, size: 9.5, font: fontRegular, color: colorBody });
  const formattedAmt = `INR ${data.amount.toLocaleString('en-IN')}`;
  page.drawText(formattedAmt, { x: tableX + 375, y, size: 9.5, font: fontRegular, color: colorBody });
  page.drawText(formattedAmt, { x: tableX + 440, y, size: 9.5, font: fontBold, color: colorNavy });

  y -= 14;
  page.drawLine({
    start: { x: tableX, y },
    end: { x: tableX + tableW, y },
    thickness: 0.5,
    color: colorBorder,
  });

  y -= 30;
  // Payment Terms & Notes (Left) & Summary (Right)
  const notesW = 250;
  const is100Pct = data.isFullPayment || (data.totalProjectCost && data.amount >= data.totalProjectCost);

  page.drawRectangle({
    x: tableX,
    y: y - 110,
    width: notesW,
    height: 120,
    color: colorBgLight,
    borderColor: colorBorder,
    borderWidth: 1,
  });

  page.drawText('Payment Terms & Notes', { x: tableX + 12, y: y - 2, size: 10, font: fontBold, color: colorNavy });

  // Custom or milestone description
  if (data.notes && data.notes.trim().length > 0) {
    const customNote = data.notes.trim();
    const truncatedNote = customNote.length > 50 ? customNote.substring(0, 48) + '...' : customNote;
    page.drawText(`• ${truncatedNote}`, { x: tableX + 12, y: y - 18, size: 8, font: fontRegular, color: colorBody });
  } else if (is100Pct) {
    page.drawText('• 100% full project payment completed successfully.', { x: tableX + 12, y: y - 18, size: 8, font: fontRegular, color: colorBody });
  } else {
    page.drawText(`• Invoice covers ${milestoneClean} settlement`, { x: tableX + 12, y: y - 18, size: 8, font: fontRegular, color: colorBody });
  }

  page.drawText(`• Project: "${(data.projectTitle || 'System Implementation').slice(0, 32)}"`, { x: tableX + 12, y: y - 30, size: 8, font: fontRegular, color: colorBody });
  page.drawText(`• Verified settlement via ${paymentModeText}.`, { x: tableX + 12, y: y - 42, size: 8, font: fontBold, color: colorNavy });
  page.drawText('• Non-refundable, adjusted against total contracted scope.', { x: tableX + 12, y: y - 54, size: 7.5, font: fontRegular, color: colorMuted });

  // Summary Table (Right)
  const sumX = 350;
  let sumY = y;
  const drawSummaryRow = (lbl: string, val: string, isBold = false, isGreen = false) => {
    page.drawText(lbl, { x: sumX, y: sumY, size: 9.5, font: isBold ? fontBold : fontRegular, color: isGreen ? colorSuccess : colorBody });
    page.drawText(val, { x: sumX + 90, y: sumY, size: 9.5, font: isBold ? fontBold : fontRegular, color: isGreen ? colorSuccess : colorNavy });
    sumY -= 16;
  };

  const isPaidState = (data.status || (data.paymentDate ? 'paid' : 'unpaid')).toLowerCase().includes('paid') ||
    (data.status || '').toLowerCase().includes('received');

  drawSummaryRow('Subtotal', formattedAmt);
  drawSummaryRow('Tax / GST', 'Nil / Exempt');
  drawSummaryRow('Total Amount', formattedAmt, true);
  drawSummaryRow('Total Settled', isPaidState ? formattedAmt : 'INR 0', true);
  drawSummaryRow('Balance Due', isPaidState ? 'INR 0.00' : formattedAmt, true, isPaidState);

  // 4-Status Stamp in Summary Section: shifted left so it never overlaps the amounts on the right
  const statusStr = (data.status || (data.paymentDate ? 'paid' : 'unpaid')).toLowerCase();
  let stampText = 'PAID';
  let stampColor = colorSuccess;
  let stampBg = rgb(240 / 255, 253 / 255, 244 / 255);

  if (statusStr.includes('refund')) {
    stampText = 'REFUNDED';
    stampColor = rgb(124 / 255, 92 / 255, 232 / 255);
    stampBg = rgb(245 / 255, 243 / 255, 255 / 255);
  } else if (statusStr.includes('fail')) {
    stampText = 'FAILED';
    stampColor = rgb(220 / 255, 38 / 255, 38 / 255);
    stampBg = rgb(254 / 255, 242 / 255, 242 / 255);
  } else if (!data.paymentDate || statusStr.includes('unpaid') || statusStr.includes('pending')) {
    stampText = 'UNPAID';
    stampColor = rgb(217 / 255, 119 / 255, 6 / 255);
    stampBg = rgb(254 / 255, 243 / 255, 199 / 255);
  }

  const stampWidth = 75;
  const stampHeight = 22;
  const stampX = sumX - 5; // Left of the numbers (numbers are at sumX + 90)
  const stampY = sumY - 4;

  page.drawRectangle({
    x: stampX,
    y: stampY,
    width: stampWidth,
    height: stampHeight,
    borderColor: stampColor,
    borderWidth: 1.5,
    color: stampBg,
  });
  const textW = fontBold.widthOfTextAtSize(stampText, 10);
  page.drawText(stampText, {
    x: stampX + (stampWidth - textW) / 2,
    y: stampY + 6,
    size: 10,
    font: fontBold,
    color: stampColor,
  });

  // Footer (Bottom of Page - Pinned cleanly)
  const footerY = 48;
  page.drawLine({
    start: { x: 50, y: footerY + 25 },
    end: { x: width - 50, y: footerY + 25 },
    thickness: 0.5,
    color: colorBorder,
  });

  const footerText1 = 'InfoHQ Pvt Ltd   •   Prayagraj, Uttar Pradesh, India   •   billing@infohq.in   |   infohq.in';
  const f1Width = fontRegular.widthOfTextAtSize(footerText1, 8.5);
  page.drawText(footerText1, {
    x: (width - f1Width) / 2,
    y: footerY + 12,
    size: 8.5,
    font: fontRegular,
    color: colorMuted,
  });

  const footerText2 = 'This is a computer-generated tax invoice verified by InfoHQ Command Center.';
  const f2Width = fontRegular.widthOfTextAtSize(footerText2, 7.5);
  page.drawText(footerText2, {
    x: (width - f2Width) / 2,
    y: footerY,
    size: 7.5,
    font: fontRegular,
    color: rgb(156 / 255, 163 / 255, 175 / 255),
  });

  return await pdfDoc.save();
}

