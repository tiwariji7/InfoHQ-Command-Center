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
 * matching InfoHQ Command Center luxury design specification.
 */
export async function generateInvoicePdf(data: InvoicePdfOptions): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  // Standard A4 dimensions: 595.28 x 841.89 points
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Exact Brand Colors matching website & CRM design
  const colorNavy = rgb(26 / 255, 8 / 255, 92 / 255);         // #1A085C (Headings)
  const colorCoral = rgb(232 / 255, 96 / 255, 78 / 255);      // #E8604E (Coral-Orange Brand)
  const colorViolet = rgb(91 / 255, 76 / 255, 245 / 255);     // #5B4CF5 (Action Brand)
  const colorPurple = rgb(124 / 255, 92 / 255, 232 / 255);    // #7C5CE8 (HQ Signature)
  const colorPink = rgb(232 / 255, 90 / 255, 160 / 255);      // #E85AA0 (Accent Pink)
  const colorBody = rgb(55 / 255, 65 / 255, 81 / 255);        // #374151 (Body Text)
  const colorMuted = rgb(107 / 255, 114 / 255, 128 / 255);    // #6B7280 (Muted Labels)
  const colorSubtle = rgb(156 / 255, 163 / 255, 175 / 255);  // #9CA3AF (Subtle)
  const colorBorder = rgb(233 / 255, 213 / 255, 255 / 255);  // #E9D5FF (Card Borders)
  const colorBgBox = rgb(250 / 255, 248 / 255, 255 / 255);   // #FAF8FF (Light Tint)
  const colorTableBorder = rgb(240 / 255, 237 / 255, 249 / 255); // #F0EDF9
  const colorWhite = rgb(1, 1, 1);
  const colorSuccess = rgb(4 / 255, 120 / 255, 87 / 255);     // #047857 (Paid Emerald)

  const marginX = 45;
  const contentW = width - marginX * 2; // 505.28

  // 1. BRAND HEADER (Info Coral, HQ Violet, Pvt Ltd Navy)
  let y = height - 48; // 793.89
  page.drawText('Info', { x: marginX, y, size: 24, font: fontBold, color: colorCoral });
  const infoW = fontBold.widthOfTextAtSize('Info', 24);
  page.drawText('HQ', { x: marginX + infoW, y, size: 24, font: fontBold, color: colorViolet });
  const hqW = fontBold.widthOfTextAtSize('HQ', 24);
  page.drawText(' Pvt Ltd', { x: marginX + infoW + hqW, y, size: 16, font: fontBold, color: colorNavy });

  y -= 18;
  page.drawText('Engineering Studio for AI, SaaS & Digital Systems', {
    x: marginX,
    y,
    size: 9.5,
    font: fontRegular,
    color: colorMuted,
  });

  // 3-Tone Brand Gradient Bar
  y -= 14;
  const segW = contentW / 3;
  page.drawLine({ start: { x: marginX, y }, end: { x: marginX + segW, y }, thickness: 2.5, color: colorViolet });
  page.drawLine({ start: { x: marginX + segW, y }, end: { x: marginX + segW * 2, y }, thickness: 2.5, color: colorPurple });
  page.drawLine({ start: { x: marginX + segW * 2, y }, end: { x: marginX + contentW, y }, thickness: 2.5, color: colorPink });

  // 2. INVOICE TITLE & INVOICE NUMBER
  y -= 28;
  page.drawText('INVOICE', { x: marginX, y, size: 24, font: fontBold, color: colorNavy });

  y -= 18;
  page.drawText('Invoice No.', { x: marginX, y, size: 10, font: fontBold, color: colorMuted });
  const invNumberText = data.invoiceNumber || 'INV-2026-001';
  page.drawText(invNumberText, { x: marginX + 68, y, size: 12, font: fontBold, color: colorViolet });

  // 3. TWO COLUMNS METADATA SECTION
  y -= 26;
  const colY = y;
  const clientIdText = data.clientId || 'CLT-2026';
  const issueDateText = data.issueDate || new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date());
  const paymentDateText = data.paymentDate || 'Pending';
  const paymentModeText = data.paymentMode || 'Online Checkout / UPI';
  const txRefText = data.transactionRef || 'Pending Online Checkout';

  // Left Column: Bill To
  page.drawText('BILL TO', { x: marginX, y: colY, size: 8.5, font: fontBold, color: colorMuted });
  page.drawText(data.clientName || 'Valued Client', { x: marginX, y: colY - 16, size: 13, font: fontBold, color: colorNavy });
  let billCursorY = colY - 30;
  if (data.clientEmail && data.clientEmail !== '—') {
    page.drawText(data.clientEmail, { x: marginX, y: billCursorY, size: 9, font: fontRegular, color: colorBody });
    billCursorY -= 13;
  }
  if (data.clientPhone && data.clientPhone !== '—') {
    page.drawText(data.clientPhone, { x: marginX, y: billCursorY, size: 9, font: fontRegular, color: colorBody });
    billCursorY -= 13;
  }
  page.drawText('Account ID:  ', { x: marginX, y: billCursorY, size: 9, font: fontRegular, color: colorMuted });
  page.drawText(clientIdText, { x: marginX + 62, y: billCursorY, size: 9, font: fontBold, color: colorNavy });

  // Right Column: Key-Value aligned with colon
  const rightColX = 305;
  const colonX = 385;
  const valX = 395;
  const drawMeta = (lbl: string, val: string, rY: number) => {
    page.drawText(lbl, { x: rightColX, y: rY, size: 9, font: fontRegular, color: colorMuted });
    page.drawText(':', { x: colonX, y: rY, size: 9, font: fontBold, color: colorSubtle });
    const cleanVal = val.length > 24 ? val.substring(0, 22) + '...' : val;
    page.drawText(cleanVal, { x: valX, y: rY, size: 9, font: fontBold, color: colorNavy });
  };

  drawMeta('Client ID', clientIdText, colY);
  drawMeta('Issue Date', issueDateText, colY - 14);
  drawMeta('Payment Date', paymentDateText, colY - 28);
  drawMeta('Payment Mode', paymentModeText, colY - 42);
  drawMeta('Transaction Ref.', txRefText, colY - 56);

  // 4. ITEMS TABLE (Royal Purple Header Bar)
  y = colY - 82;
  const tableH = 22;
  page.drawRectangle({
    x: marginX,
    y: y - tableH,
    width: contentW,
    height: tableH,
    color: colorViolet,
  });

  const headerY = y - 15;
  page.drawText('#', { x: marginX + 12, y: headerY, size: 8.5, font: fontBold, color: colorWhite });
  page.drawText('Description', { x: marginX + 38, y: headerY, size: 8.5, font: fontBold, color: colorWhite });
  page.drawText('Qty', { x: marginX + 325, y: headerY, size: 8.5, font: fontBold, color: colorWhite });

  const unitPriceHeaderW = fontBold.widthOfTextAtSize('Unit Price', 8.5);
  page.drawText('Unit Price', { x: marginX + 430 - unitPriceHeaderW, y: headerY, size: 8.5, font: fontBold, color: colorWhite });

  const amtHeaderW = fontBold.widthOfTextAtSize('Amount', 8.5);
  page.drawText('Amount', { x: marginX + contentW - 14 - amtHeaderW, y: headerY, size: 8.5, font: fontBold, color: colorWhite });

  y -= tableH + 6;

  // Parse items from itemsJson if available
  let items: Array<any> = [];
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

  // Draw Items Rows (up to 5 items)
  items.slice(0, 5).forEach((item: any, idx) => {
    const itemNum = String(item.num || idx + 1);
    const itemDesc = String(item.desc || item.description || item.title || item.name || 'Milestone Delivery').trim();
    const itemQty = String(item.qty || item.quantity || 1);
    const itemRate = Number(item.rate || item.price || item.unitPrice || item.amount || 0);
    const itemAmt = Number(item.amount || (Number(itemQty) * itemRate) || itemRate);

    y -= 14;
    page.drawText(itemNum, { x: marginX + 12, y, size: 9, font: fontBold, color: colorNavy });
    const truncated = itemDesc.length > 55 ? itemDesc.substring(0, 53) + '...' : itemDesc;
    page.drawText(truncated, { x: marginX + 38, y, size: 9, font: fontBold, color: colorNavy });
    page.drawText(itemQty, { x: marginX + 330, y, size: 9, font: fontRegular, color: colorBody });

    const rateStr = `INR ${itemRate.toLocaleString('en-IN')}`;
    const rateW = fontRegular.widthOfTextAtSize(rateStr, 9);
    page.drawText(rateStr, { x: marginX + 430 - rateW, y, size: 9, font: fontRegular, color: colorBody });

    const amtStr = `INR ${itemAmt.toLocaleString('en-IN')}`;
    const amtW = fontBold.widthOfTextAtSize(amtStr, 9);
    page.drawText(amtStr, { x: marginX + contentW - 14 - amtW, y, size: 9, font: fontBold, color: colorNavy });

    y -= 10;
    page.drawLine({
      start: { x: marginX, y },
      end: { x: marginX + contentW, y },
      thickness: 0.6,
      color: colorTableBorder,
    });
    y -= 4;
  });

  // 5. BOTTOM SECTION: 2 EQUAL BOXES (Payment Terms vs Summary & Real Rubber Stamp)
  y -= 16;
  const boxW = 244;
  const boxH = 140;
  const boxY = y - boxH;

  // Left Box: Payment Terms & Notes
  page.drawRectangle({
    x: marginX,
    y: boxY,
    width: boxW,
    height: boxH,
    color: colorBgBox,
    borderColor: colorBorder,
    borderWidth: 1,
  });

  page.drawText('Payment Terms & Notes', { x: marginX + 14, y: y - 18, size: 9.5, font: fontBold, color: colorNavy });
  page.drawLine({
    start: { x: marginX + 14, y: y - 24 },
    end: { x: marginX + boxW - 14, y: y - 24 },
    thickness: 0.6,
    color: colorBorder,
  });

  let noteY = y - 38;
  if (data.milestoneTitle && data.milestoneTitle.trim().length > 0) {
    page.drawText('Milestone Description:', { x: marginX + 14, y: noteY, size: 8, font: fontBold, color: colorNavy });
    noteY -= 12;
    const cleanMilestone = data.milestoneTitle.trim();
    const truncatedMilestone = cleanMilestone.length > 46 ? cleanMilestone.substring(0, 44) + '...' : cleanMilestone;
    page.drawText(truncatedMilestone, { x: marginX + 14, y: noteY, size: 8, font: fontRegular, color: colorBody });
    noteY -= 16;
  }

  if (data.notes && data.notes.trim().length > 0) {
    page.drawText('Terms & Notes:', { x: marginX + 14, y: noteY, size: 8, font: fontBold, color: colorNavy });
    noteY -= 12;
    const cleanNote = data.notes.trim();
    const lines = cleanNote.split('\n');
    for (const l of lines.slice(0, 3)) {
      const lineTrunc = l.trim().length > 46 ? l.trim().substring(0, 44) + '...' : l.trim();
      page.drawText(lineTrunc, { x: marginX + 14, y: noteY, size: 8, font: fontRegular, color: colorBody });
      noteY -= 11;
    }
  } else if (!data.milestoneTitle || data.milestoneTitle.trim().length === 0) {
    page.drawText('No specific payment terms or notes provided.', { x: marginX + 14, y: noteY, size: 7.5, font: fontRegular, color: colorMuted });
  }

  // Right Box: Summary & Totals
  const sumBoxX = marginX + contentW - boxW;
  page.drawRectangle({
    x: sumBoxX,
    y: boxY,
    width: boxW,
    height: boxH,
    color: colorBgBox,
    borderColor: colorBorder,
    borderWidth: 1,
  });

  const numAmt = Number(data.amount) || 0;
  const formattedAmt = `INR ${numAmt.toLocaleString('en-IN')}`;

  const isPaidState =
    (data.status || '').toLowerCase() === 'received' ||
    (data.status || '').toLowerCase() === 'paid' ||
    (data.status || '').toLowerCase() === 'completed' ||
    (!!data.paymentDate && data.paymentDate !== 'Pending');

  const statusStr = (data.status || (isPaidState ? 'paid' : 'unpaid')).toLowerCase();

  let sumRowY = y - 18;
  const drawSummaryLine = (lbl: string, val: string, isBold = false, isPurple = false, isGreen = false) => {
    const f = isBold ? fontBold : fontRegular;
    const c = isPurple ? colorViolet : isGreen ? colorSuccess : colorBody;
    const vC = isPurple ? colorViolet : isGreen ? colorSuccess : isBold ? colorNavy : colorBody;
    page.drawText(lbl, { x: sumBoxX + 14, y: sumRowY, size: 9, font: f, color: c });
    const vW = f.widthOfTextAtSize(val, 9);
    page.drawText(val, { x: sumBoxX + boxW - 14 - vW, y: sumRowY, size: 9, font: f, color: vC });
    sumRowY -= 16;
  };

  drawSummaryLine('Subtotal', formattedAmt);
  drawSummaryLine('Tax / GST', 'Nil / Exempt');

  // Total Amount highlight bar
  page.drawLine({ start: { x: sumBoxX + 14, y: sumRowY + 4 }, end: { x: sumBoxX + boxW - 14, y: sumRowY + 4 }, thickness: 0.8, color: colorBorder });
  drawSummaryLine('Total Amount', formattedAmt, true, true);
  page.drawLine({ start: { x: sumBoxX + 14, y: sumRowY + 14 }, end: { x: sumBoxX + boxW - 14, y: sumRowY + 14 }, thickness: 0.8, color: colorBorder });

  drawSummaryLine('Total Settled', isPaidState ? formattedAmt : 'INR 0');
  drawSummaryLine('Balance Due', isPaidState ? 'INR 0.00' : formattedAmt, true, false, isPaidState);

  // 6. AUTHENTIC DOUBLE-LINE REAL RUBBER INK STAMP (-12 degrees)
  let stampMainText = 'P A I D';
  let stampTopText = 'OFFICIAL RECEIPT';
  let stampBotText = 'VERIFIED & SETTLED';
  let stampColor = colorSuccess;
  let stampBg = rgb(240 / 255, 253 / 255, 244 / 255);

  if (statusStr.includes('refund')) {
    stampMainText = 'R E F U N D E D';
    stampTopText = 'AMOUNT REVERSED';
    stampBotText = 'OFFICIAL SETTLEMENT';
    stampColor = rgb(109 / 255, 40 / 255, 217 / 255);
    stampBg = rgb(245 / 255, 243 / 255, 255 / 255);
  } else if (statusStr.includes('fail')) {
    stampMainText = 'F A I L E D';
    stampTopText = 'TRANSACTION FAILED';
    stampBotText = 'UNSUCCESSFUL ATTEMPT';
    stampColor = rgb(220 / 255, 38 / 255, 38 / 255);
    stampBg = rgb(254 / 255, 242 / 255, 242 / 255);
  } else if (statusStr.includes('expire')) {
    stampMainText = 'E X P I R E D';
    stampTopText = 'WINDOW CLOSED';
    stampBotText = 'LINK INACTIVE';
    stampColor = rgb(194 / 255, 65 / 255, 12 / 255);
    stampBg = rgb(255 / 255, 237 / 255, 213 / 255);
  } else if (!isPaidState || statusStr.includes('unpaid') || statusStr.includes('pending')) {
    stampMainText = 'U N P A I D';
    stampTopText = 'PAYMENT PENDING';
    stampBotText = 'ACTION REQUIRED';
    stampColor = rgb(217 / 255, 119 / 255, 6 / 255);
    stampBg = rgb(254 / 255, 243 / 255, 199 / 255);
  }

  const angle = -12;
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const stampW = 108;
  const stampH = 44;
  const stampX = sumBoxX + 50;
  const stampY = boxY + 20;
  const p = 2.5;

  const getRotated = (dx: number, dy: number) => ({
    x: stampX + dx * cos - dy * sin,
    y: stampY + dx * sin + dy * cos,
  });

  // Outer Border (Thick Ink Line)
  page.drawRectangle({
    x: stampX,
    y: stampY,
    width: stampW,
    height: stampH,
    borderColor: stampColor,
    borderWidth: 2.2,
    color: stampBg,
    rotate: degrees(angle),
  });

  // Inner Border (Thin Inset Line)
  const innerPos = getRotated(p, p);
  page.drawRectangle({
    x: innerPos.x,
    y: innerPos.y,
    width: stampW - p * 2,
    height: stampH - p * 2,
    borderColor: stampColor,
    borderWidth: 0.8,
    rotate: degrees(angle),
  });

  // Top Subtext Banner
  const topW = fontBold.widthOfTextAtSize(stampTopText, 6.5);
  const topPos = getRotated((stampW - topW) / 2, stampH - 11);
  page.drawText(stampTopText, {
    x: topPos.x,
    y: topPos.y,
    size: 6.5,
    font: fontBold,
    color: stampColor,
    rotate: degrees(angle),
  });

  // Center Main Status Word (Stamped uppercase)
  const mainW = fontBold.widthOfTextAtSize(stampMainText, 16);
  const mainPos = getRotated((stampW - mainW) / 2, (stampH - 16) / 2 + 1);
  page.drawText(stampMainText, {
    x: mainPos.x,
    y: mainPos.y,
    size: 16,
    font: fontBold,
    color: stampColor,
    rotate: degrees(angle),
  });

  // Bottom Subtext Banner
  const botW = fontBold.widthOfTextAtSize(stampBotText, 6);
  const botPos = getRotated((stampW - botW) / 2, 5.5);
  page.drawText(stampBotText, {
    x: botPos.x,
    y: botPos.y,
    size: 6,
    font: fontBold,
    color: stampColor,
    rotate: degrees(angle),
  });

  // 7. PINNED FOOTER (Strictly at the bottom of A4)
  const footerLineY = 72;
  page.drawLine({
    start: { x: marginX, y: footerLineY },
    end: { x: marginX + contentW, y: footerLineY },
    thickness: 0.7,
    color: rgb(229 / 255, 231 / 255, 235 / 255),
  });

  // Line 1: Info (Coral), HQ (Violet), Pvt Ltd & Address (Navy)
  const fLine1Y = 54;
  const fInfoW = fontBold.widthOfTextAtSize('Info', 9.5);
  const fHqW = fontBold.widthOfTextAtSize('HQ', 9.5);
  const fText = ' Pvt Ltd   •   Prayagraj, Uttar Pradesh, India';
  const fTotalW = fInfoW + fHqW + fontBold.widthOfTextAtSize(fText, 9.5);
  const fStart1X = (width - fTotalW) / 2;

  page.drawText('Info', { x: fStart1X, y: fLine1Y, size: 9.5, font: fontBold, color: colorCoral });
  page.drawText('HQ', { x: fStart1X + fInfoW, y: fLine1Y, size: 9.5, font: fontBold, color: colorViolet });
  page.drawText(fText, { x: fStart1X + fInfoW + fHqW, y: fLine1Y, size: 9.5, font: fontBold, color: colorNavy });

  // Line 2: email | website
  const fLine2 = 'billing@infohq.in   |   infohq.in';
  const fLine2W = fontRegular.widthOfTextAtSize(fLine2, 8.5);
  page.drawText(fLine2, { x: (width - fLine2W) / 2, y: 41, size: 8.5, font: fontRegular, color: colorMuted });

  // Line 3: legal note
  const fLine3 = 'This is a computer-generated tax invoice verified by InfoHQ Command Center.';
  const fLine3W = fontRegular.widthOfTextAtSize(fLine3, 7.5);
  page.drawText(fLine3, { x: (width - fLine3W) / 2, y: 29, size: 7.5, font: fontRegular, color: colorSubtle });

  return await pdfDoc.save();
}
