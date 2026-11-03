import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';

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
  itemsJson?: string;
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

  // Exact Brand Colors
  const colorNavy = rgb(26 / 255, 8 / 255, 92 / 255);       // #1A085C (Headings)
  const colorOrange = rgb(232 / 255, 96 / 255, 78 / 255);    // #E8604E (Coral-Orange Brand)
  const colorPurple = rgb(124 / 255, 92 / 255, 232 / 255);   // #7C5CE8 (HQ Signature)
  const colorViolet = rgb(91 / 255, 76 / 255, 245 / 255);    // #5B4CF5 (Action Brand)
  const colorPink = rgb(232 / 255, 90 / 255, 160 / 255);     // #E85AA0 (Accent Pink)
  const colorBody = rgb(75 / 255, 85 / 255, 99 / 255);       // #4B5563 (Body Text)
  const colorMuted = rgb(107 / 255, 114 / 255, 128 / 255);   // #6B7280 (Muted Labels)
  const colorBorder = rgb(234 / 255, 230 / 255, 247 / 255);  // #EAE6F7 (Card Borders)
  const colorBgLight = rgb(250 / 255, 248 / 255, 255 / 255); // #FAF8FF (Light Tint)
  const colorSuccess = rgb(21 / 255, 128 / 255, 61 / 255);   // #15803D (Paid Emerald)
  const colorWhite = rgb(1, 1, 1);

  let y = height - 48;

  // 1. Header: InfoHQ Pvt Ltd (Info in Coral-Orange, HQ in Violet, Pvt Ltd in Navy)
  page.drawText('Info', { x: 50, y, size: 24, font: fontBold, color: colorOrange });
  const infoWidth = fontBold.widthOfTextAtSize('Info', 24);
  page.drawText('HQ', { x: 50 + infoWidth, y, size: 24, font: fontBold, color: colorViolet });
  const hqWidth = fontBold.widthOfTextAtSize('HQ', 24);
  page.drawText(' Pvt Ltd', { x: 50 + infoWidth + hqWidth, y, size: 18, font: fontBold, color: colorNavy });

  y -= 17;
  page.drawText('Engineering Studio for AI, SaaS & Digital Systems', {
    x: 50,
    y,
    size: 9.5,
    font: fontRegular,
    color: colorMuted,
  });

  y -= 16;
  // Brand 3-Color Gradient Accent Bar (#5B4CF5 -> #7C5CE8 -> #E85AA0)
  const totalBarWidth = width - 100;
  const segW = totalBarWidth / 3;
  page.drawLine({
    start: { x: 50, y },
    end: { x: 50 + segW, y },
    thickness: 2.5,
    color: colorViolet,
  });
  page.drawLine({
    start: { x: 50 + segW, y },
    end: { x: 50 + segW * 2, y },
    thickness: 2.5,
    color: colorPurple,
  });
  page.drawLine({
    start: { x: 50 + segW * 2, y },
    end: { x: 50 + totalBarWidth, y },
    thickness: 2.5,
    color: colorPink,
  });

  y -= 30;
  // INVOICE Title (Capital, bold, no pill)
  page.drawText('INVOICE', { x: 50, y, size: 22, font: fontBold, color: colorNavy });

  y -= 20;
  // Invoice Number (Clean plain typography - no pill background)
  const invNumberText = data.invoiceNumber || 'INV-2026-653';
  page.drawText('Invoice No.', { x: 50, y, size: 11, font: fontBold, color: colorMuted });
  page.drawText(invNumberText, { x: 125, y, size: 12, font: fontBold, color: colorViolet });

  // Right Column Metadata
  const rightX = 350;
  let metaY = y + 20;

  const drawMetaRow = (label: string, val: string) => {
    page.drawText(label, { x: rightX, y: metaY, size: 9, font: fontRegular, color: colorMuted });
    page.drawText(':', { x: rightX + 80, y: metaY, size: 9, font: fontBold, color: colorMuted });
    page.drawText(val, { x: rightX + 90, y: metaY, size: 9, font: fontBold, color: colorNavy });
    metaY -= 14;
  };

  const clientIdText = data.clientId || 'CLT-2026';
  const issueDateText = data.issueDate || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const paymentDateText = data.paymentDate || 'Pending';
  const paymentModeText = data.paymentMode || 'Online Checkout / UPI';
  const txRefText = data.transactionRef || 'Pending Online Checkout';

  drawMetaRow('Client ID', clientIdText);
  drawMetaRow('Issue Date', issueDateText);
  drawMetaRow('Payment Date', paymentDateText);
  drawMetaRow('Payment Mode', paymentModeText);
  drawMetaRow('Transaction Ref.', txRefText.length > 20 ? txRefText.substring(0, 18) + '...' : txRefText);

  y -= 36;
  // Bill To (Left Column)
  page.drawText('Bill To', { x: 50, y, size: 9, font: fontBold, color: colorMuted });
  y -= 14;
  page.drawText(data.clientName || 'Valued Client', { x: 50, y, size: 13, font: fontBold, color: colorNavy });
  y -= 13;
  if (data.clientEmail && data.clientEmail !== '—') {
    page.drawText(data.clientEmail, { x: 50, y, size: 9, font: fontRegular, color: colorBody });
    y -= 12;
  }
  if (data.clientPhone && data.clientPhone !== '—') {
    page.drawText(data.clientPhone, { x: 50, y, size: 9, font: fontRegular, color: colorBody });
    y -= 12;
  }
  page.drawText('Account ID:  ' + clientIdText, { x: 50, y, size: 9, font: fontBold, color: colorNavy });

  y -= 26;
  // Items Table
  const tableX = 50;
  const tableW = width - 100;

  // Table Header Bar (Royal Purple)
  page.drawRectangle({
    x: tableX,
    y: y - 5,
    width: tableW,
    height: 22,
    color: colorViolet,
  });

  page.drawText('#', { x: tableX + 10, y: y + 2, size: 8.5, font: fontBold, color: colorWhite });
  page.drawText('Description', { x: tableX + 35, y: y + 2, size: 8.5, font: fontBold, color: colorWhite });
  page.drawText('Qty', { x: tableX + 320, y: y + 2, size: 8.5, font: fontBold, color: colorWhite });
  page.drawText('Unit Price', { x: tableX + 365, y: y + 2, size: 8.5, font: fontBold, color: colorWhite });
  page.drawText('Amount', { x: tableX + 440, y: y + 2, size: 8.5, font: fontBold, color: colorWhite });

  y -= 22;

  // Parse items from itemsJson if available
  let items: Array<{ num?: number; desc: string; qty?: number; rate?: number; amount: number }> = [];
  if (data.itemsJson) {
    try {
      items = JSON.parse(data.itemsJson);
    } catch {
      // fallback
    }
  }

  if (!items || items.length === 0) {
    const milestoneClean = (data.milestoneTitle || 'Milestone Delivery').trim();
    items = [
      {
        num: 1,
        desc: data.projectTitle ? `${milestoneClean}: ${data.projectTitle}` : milestoneClean,
        qty: 1,
        rate: Number(data.amount) || 0,
        amount: Number(data.amount) || 0,
      },
    ];
  }

  // Draw Items Rows
  items.slice(0, 5).forEach((item, idx) => {
    const itemNum = String(item.num || idx + 1);
    const itemQty = String(item.qty || 1);
    const itemRate = Number(item.rate || item.amount || 0);
    const itemAmt = Number(item.amount || itemRate);

    page.drawText(itemNum, { x: tableX + 10, y, size: 9, font: fontRegular, color: colorNavy });
    const truncatedDesc = item.desc.length > 50 ? item.desc.substring(0, 48) + '...' : item.desc;
    page.drawText(truncatedDesc, { x: tableX + 35, y, size: 9, font: fontBold, color: colorNavy });
    page.drawText(itemQty, { x: tableX + 325, y, size: 9, font: fontRegular, color: colorBody });
    page.drawText(`INR ${itemRate.toLocaleString('en-IN')}`, { x: tableX + 365, y, size: 9, font: fontRegular, color: colorBody });
    page.drawText(`INR ${itemAmt.toLocaleString('en-IN')}`, { x: tableX + 440, y, size: 9, font: fontBold, color: colorNavy });

    y -= 12;
    page.drawLine({
      start: { x: tableX, y },
      end: { x: tableX + tableW, y },
      thickness: 0.5,
      color: colorBorder,
    });
    y -= 14;
  });

  y -= 12;

  // Bottom Section: Payment Terms & Notes (Left) vs Summary & Stamp (Right)
  const notesW = 240;
  const bottomBoxH = 118;

  // Left Box: Payment Terms & Notes
  page.drawRectangle({
    x: tableX,
    y: y - bottomBoxH,
    width: notesW,
    height: bottomBoxH,
    color: colorBgLight,
    borderColor: colorBorder,
    borderWidth: 1,
  });

  page.drawText('Payment Terms & Notes', { x: tableX + 12, y: y - 14, size: 9.5, font: fontBold, color: colorNavy });

  let noteCursorY = y - 30;
  if (data.milestoneTitle && data.milestoneTitle.trim().length > 0) {
    page.drawText('Milestone / Description:', { x: tableX + 12, y: noteCursorY, size: 8, font: fontBold, color: colorNavy });
    noteCursorY -= 11;
    const cleanMilestone = data.milestoneTitle.trim();
    const truncatedMilestone = cleanMilestone.length > 48 ? cleanMilestone.substring(0, 46) + '...' : cleanMilestone;
    page.drawText(truncatedMilestone, { x: tableX + 12, y: noteCursorY, size: 8, font: fontRegular, color: colorBody });
    noteCursorY -= 14;
  }

  if (data.notes && data.notes.trim().length > 0) {
    page.drawText('Terms & Notes:', { x: tableX + 12, y: noteCursorY, size: 8, font: fontBold, color: colorNavy });
    noteCursorY -= 11;
    const customNote = data.notes.trim();
    const truncatedNote = customNote.length > 48 ? customNote.substring(0, 46) + '...' : customNote;
    page.drawText(truncatedNote, { x: tableX + 12, y: noteCursorY, size: 8, font: fontRegular, color: colorBody });
  } else if (!data.milestoneTitle || data.milestoneTitle.trim().length === 0) {
    page.drawText('No specific payment terms or notes provided.', { x: tableX + 12, y: noteCursorY, size: 7.5, font: fontRegular, color: colorMuted });
  }

  // Right Box: Summary & Totals
  const sumBoxX = 310;
  const sumBoxW = width - 50 - sumBoxX;

  page.drawRectangle({
    x: sumBoxX,
    y: y - bottomBoxH,
    width: sumBoxW,
    height: bottomBoxH,
    color: colorBgLight,
    borderColor: colorBorder,
    borderWidth: 1,
  });

  const numAmt = Number(data.amount) || 0;
  const formattedAmt = `INR ${numAmt.toLocaleString('en-IN')}`;

  const isPaidState = (data.status || '').toLowerCase() === 'received' || (data.status || '').toLowerCase() === 'paid' || !!data.paymentDate && data.paymentDate !== 'Pending';
  const statusStr = (data.status || (isPaidState ? 'paid' : 'unpaid')).toLowerCase();

  let sumRowY = y - 16;
  const drawSummaryRow = (lbl: string, val: string, isBold = false, isGreen = false) => {
    page.drawText(lbl, { x: sumBoxX + 12, y: sumRowY, size: 9, font: isBold ? fontBold : fontRegular, color: isGreen ? colorSuccess : colorBody });
    const valWidth = (isBold ? fontBold : fontRegular).widthOfTextAtSize(val, 9);
    page.drawText(val, { x: sumBoxX + sumBoxW - valWidth - 12, y: sumRowY, size: 9, font: isBold ? fontBold : fontRegular, color: isGreen ? colorSuccess : colorNavy });
    sumRowY -= 16;
  };

  drawSummaryRow('Subtotal', formattedAmt);
  drawSummaryRow('Tax / GST', 'Nil / Exempt');
  drawSummaryRow('Total Amount', formattedAmt, true);
  drawSummaryRow('Total Settled', isPaidState ? formattedAmt : 'INR 0', true);
  drawSummaryRow('Balance Due', isPaidState ? 'INR 0.00' : formattedAmt, true, isPaidState);

  // Rotated Authentic Stamp (-12 degrees)
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
  } else if (statusStr.includes('expire')) {
    stampText = 'EXPIRED';
    stampColor = rgb(217 / 255, 119 / 255, 6 / 255);
    stampBg = rgb(254 / 255, 243 / 255, 199 / 255);
  } else if (!isPaidState || statusStr.includes('unpaid') || statusStr.includes('pending')) {
    stampText = 'UNPAID';
    stampColor = rgb(217 / 255, 119 / 255, 6 / 255);
    stampBg = rgb(254 / 255, 243 / 255, 199 / 255);
  }

  const stampW = 76;
  const stampH = 22;
  const stampX = sumBoxX + 60;
  const stampY = y - bottomBoxH + 34;

  page.drawRectangle({
    x: stampX,
    y: stampY,
    width: stampW,
    height: stampH,
    borderColor: stampColor,
    borderWidth: 1.8,
    color: stampBg,
    rotate: degrees(-12),
  });

  const stampTextW = fontBold.widthOfTextAtSize(stampText, 10);
  page.drawText(stampText, {
    x: stampX + (stampW - stampTextW) / 2 + 1,
    y: stampY + 6,
    size: 10,
    font: fontBold,
    color: stampColor,
    rotate: degrees(-12),
  });

  // Footer (Strictly Pinned at the Bottom of A4)
  const footerY = 46;
  page.drawLine({
    start: { x: 50, y: footerY + 32 },
    end: { x: width - 50, y: footerY + 32 },
    thickness: 0.5,
    color: colorBorder,
  });

  const footerText1 = 'InfoHQ Pvt Ltd   •   Prayagraj, Uttar Pradesh, India';
  const f1Width = fontBold.widthOfTextAtSize(footerText1, 9);
  page.drawText(footerText1, {
    x: (width - f1Width) / 2,
    y: footerY + 20,
    size: 9,
    font: fontBold,
    color: colorNavy,
  });

  const footerText2 = 'billing@infohq.in   |   infohq.in';
  const f2Width = fontRegular.widthOfTextAtSize(footerText2, 8.5);
  page.drawText(footerText2, {
    x: (width - f2Width) / 2,
    y: footerY + 10,
    size: 8.5,
    font: fontRegular,
    color: colorBody,
  });

  const footerText3 = 'This is a computer-generated tax invoice verified by InfoHQ Command Center.';
  const f3Width = fontRegular.widthOfTextAtSize(footerText3, 7.5);
  page.drawText(footerText3, {
    x: (width - f3Width) / 2,
    y: footerY,
    size: 7.5,
    font: fontRegular,
    color: rgb(156 / 255, 163 / 255, 175 / 255),
  });

  return await pdfDoc.save();
}
