// emailService.js - Nodemailer email + PDF invoice generation
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");

// ============================================
// TRANSPORTER SETUP
// ============================================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

// ============================================
// GENERATE PDF INVOICE BUFFER
// ============================================
function generateInvoicePDF(quote) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];

    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    // Header background bar
    doc.rect(0, 0, 612, 80).fill("#0f172a");
    doc
      .fillColor("#ffffff")
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("IMANI LOGISTICS", 50, 25);
    doc
      .fontSize(10)
      .fillColor("#94a3b8")
      .text("Official Invoice", 50, 55);

    doc.fillColor("#000000").moveDown(3);

    // Invoice details
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .fillColor("#0f172a")
      .text("INVOICE DETAILS", 50, 100);

    doc
      .moveTo(50, 115)
      .lineTo(560, 115)
      .strokeColor("#e2e8f0")
      .lineWidth(1)
      .stroke();

    const details = [
      ["Customer Name:", quote.full_name || quote.fullName || "—"],
      ["Email:", quote.email || "—"],
      ["Phone:", quote.phone || "—"],
      ["Company:", quote.company || "—"],
      ["Pickup:", quote.pickup_location || quote.pickupLocation || "—"],
      ["Delivery:", quote.delivery_location || quote.deliveryLocation || "—"],
      ["Shipment Type:", quote.shipment_type || quote.shipmentType || "—"],
      ["Estimated Delivery:", quote.estimated_time || quote.estimatedTime || "—"],
      ["Tracking Number:", quote.tracking_number || quote.trackingNumber || "—"]
    ];

    let y = 125;
    doc.font("Helvetica").fontSize(11);
    for (const [label, value] of details) {
      doc.fillColor("#64748b").text(label, 50, y, { width: 180 });
      doc.fillColor("#0f172a").text(value, 240, y);
      y += 22;
    }

    // Pricing section
    y += 10;
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .fillColor("#0f172a")
      .text("PRICING", 50, y);

    y += 15;
    doc
      .moveTo(50, y)
      .lineTo(560, y)
      .strokeColor("#e2e8f0")
      .lineWidth(1)
      .stroke();

    y += 10;
    const basePrice = parseFloat(quote.base_price || quote.basePrice || 0);
    const vat = parseFloat(quote.vat || 0);
    const total = parseFloat(quote.total || 0);

    const pricingRows = [
      ["Base Price:", `£${basePrice.toFixed(2)}`],
      ["VAT (20%):", `£${vat.toFixed(2)}`]
    ];

    doc.font("Helvetica").fontSize(11);
    for (const [label, value] of pricingRows) {
      doc.fillColor("#64748b").text(label, 50, y, { width: 180 });
      doc.fillColor("#0f172a").text(value, 240, y);
      y += 22;
    }

    // Total box
    y += 5;
    doc.rect(50, y, 510, 38).fill("#0f172a");
    doc
      .fillColor("#ffffff")
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("TOTAL:", 65, y + 12)
      .text(`£${total.toFixed(2)}`, 240, y + 12);

    // Footer
    y += 80;
    doc
      .fontSize(9)
      .fillColor("#94a3b8")
      .font("Helvetica")
      .text(
        "Thank you for choosing Imani Logistics. For queries, contact support@imanigifts.co.uk",
        50,
        y,
        { align: "center", width: 510 }
      );

    doc.end();
  });
}

// ============================================
// SEND QUOTE STATUS UPDATE EMAIL (to customer)
// ============================================
async function sendQuoteStatusEmail(quote) {
  if (!quote.email) return;

  const statusLabel =
    quote.status.charAt(0).toUpperCase() + quote.status.slice(1);

  let subject = `Your Imani Logistics Quote Has Been ${statusLabel}`;
  let htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #0f172a; padding: 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 22px;">Imani Logistics</h1>
        <p style="color: #94a3b8; margin: 4px 0 0;">Quote Update Notification</p>
      </div>
      <div style="padding: 32px; background: #f8fafc;">
        <p style="font-size: 16px; color: #0f172a;">Hello <strong>${quote.full_name || "Customer"}</strong>,</p>
        <p style="color: #475569;">Your logistics quote has been updated to:</p>
        <div style="background: #0f172a; color: #fff; padding: 14px 20px; border-radius: 8px; font-size: 18px; font-weight: bold; display: inline-block; margin: 8px 0;">
          ${statusLabel}
        </div>
  `;

  if (quote.estimated_time) {
    htmlBody += `<p style="color: #475569;">🕐 <strong>Estimated delivery:</strong> ${quote.estimated_time}</p>`;
  }
  if (quote.total && parseFloat(quote.total) > 0) {
    htmlBody += `<p style="color: #475569;">💷 <strong>Total:</strong> £${parseFloat(quote.total).toFixed(2)}</p>`;
  }
  if (quote.notes) {
    htmlBody += `<p style="color: #475569;">📝 <strong>Notes:</strong> ${quote.notes}</p>`;
  }
  if (quote.tracking_number) {
    htmlBody += `<p style="color: #475569;">📦 <strong>Tracking Number:</strong> ${quote.tracking_number}</p>`;
  }

  htmlBody += `
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
        <p style="color: #94a3b8; font-size: 13px;">
          Questions? Reply to this email or contact us at support@imanigifts.co.uk<br>
          © Imani Logistics
        </p>
      </div>
    </div>
  `;

  const mailOptions = {
    from: `"${process.env.FROM_NAME || "Imani Logistics"}" <${process.env.GMAIL_USER}>`,
    to: quote.email,
    subject,
    html: htmlBody
  };

  // Attach PDF invoice if quote is approved
  if (quote.status === "approved") {
    try {
      const pdfBuffer = await generateInvoicePDF(quote);
      mailOptions.attachments = [
        {
          filename: `Imani-Invoice-${quote.id}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf"
        }
      ];
      mailOptions.html += `<p style="color:#475569;">📎 Your invoice is attached to this email.</p>`;
    } catch (err) {
      console.error("PDF generation error:", err.message);
    }
  }

  await transporter.sendMail(mailOptions);
  console.log(`✉️  Quote email sent to ${quote.email} (status: ${quote.status})`);
}

// ============================================
// SEND NEW QUOTE ALERT (to admin)
// ============================================
async function sendNewQuoteAlert(quote) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return;

  await transporter.sendMail({
    from: `"${process.env.FROM_NAME || "Imani Logistics"}" <${process.env.GMAIL_USER}>`,
    to: adminEmail,
    subject: `🆕 New Quote Request from ${quote.full_name || "Customer"}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <div style="background: #0f172a; padding: 20px;">
          <h2 style="color: #fff; margin: 0;">New Quote Request</h2>
        </div>
        <div style="padding: 24px; background: #f8fafc;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="color:#64748b; padding: 6px 0;">Name</td><td><strong>${quote.full_name || "—"}</strong></td></tr>
            <tr><td style="color:#64748b; padding: 6px 0;">Email</td><td>${quote.email || "—"}</td></tr>
            <tr><td style="color:#64748b; padding: 6px 0;">Phone</td><td>${quote.phone || "—"}</td></tr>
            <tr><td style="color:#64748b; padding: 6px 0;">Route</td><td>${quote.pickup_location || "—"} → ${quote.delivery_location || "—"}</td></tr>
            <tr><td style="color:#64748b; padding: 6px 0;">Type</td><td>${quote.shipment_type || "—"}</td></tr>
            <tr><td style="color:#64748b; padding: 6px 0;">Cargo</td><td>${quote.cargo || "—"}</td></tr>
          </table>
          <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/review-quotes.html?id=${quote.id}"
             style="display:inline-block; margin-top:16px; background:#0f172a; color:#fff; padding:10px 20px; border-radius:6px; text-decoration:none;">
            Review Quote →
          </a>
        </div>
      </div>
    `
  });
  console.log(`📬 Admin alert sent for new quote ${quote.id}`);
}

// ============================================
// SEND NEW SHIPMENT ALERT (to admin)
// ============================================
async function sendNewShipmentAlert(shipment) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return;

  await transporter.sendMail({
    from: `"${process.env.FROM_NAME || "Imani Logistics"}" <${process.env.GMAIL_USER}>`,
    to: adminEmail,
    subject: `🚚 New Shipment Created: ${shipment.tracking_id}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <div style="background: #0f172a; padding: 20px;">
          <h2 style="color: #fff; margin: 0;">Shipment Created</h2>
        </div>
        <div style="padding: 24px; background: #f8fafc;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="color:#64748b; padding: 6px 0;">Tracking ID</td><td><strong>${shipment.tracking_id}</strong></td></tr>
            <tr><td style="color:#64748b; padding: 6px 0;">Customer</td><td>${shipment.customer_name}</td></tr>
            <tr><td style="color:#64748b; padding: 6px 0;">Route</td><td>${shipment.route}</td></tr>
            <tr><td style="color:#64748b; padding: 6px 0;">Type</td><td>${shipment.shipment_type}</td></tr>
            <tr><td style="color:#64748b; padding: 6px 0;">Est. Delivery</td><td>${shipment.estimated_delivery}</td></tr>
          </table>
        </div>
      </div>
    `
  });
  console.log(`📬 Admin shipment alert sent for ${shipment.tracking_id}`);
}

module.exports = {
  sendQuoteStatusEmail,
  sendNewQuoteAlert,
  sendNewShipmentAlert,
  generateInvoicePDF
};
