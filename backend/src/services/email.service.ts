import nodemailer, { Transporter } from "nodemailer";
import { CalculatedQuotationData } from "./calculation.service";
import { generateQuotationPdf } from "./pdf.service";

export interface SendEmailOptions {
  quotation: CalculatedQuotationData;
  recipientEmail?: string;
  subject?: string;
  message?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string | false;
  recipient: string;
  message: string;
}

let cachedTransporter: Transporter | null = null;

async function getTransporter(): Promise<Transporter> {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    const isGmail = host.toLowerCase().includes("gmail");
    cachedTransporter = isGmail
      ? nodemailer.createTransport({
          service: "gmail",
          auth: { user, pass },
        })
      : nodemailer.createTransport({
          host,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
          auth: { user, pass },
        });

    console.log("Using configured SMTP server:", host, `(${user})`);
    return cachedTransporter;
  }

  // Fallback to ephemeral test account (Ethereal Email)
  console.log("No SMTP credentials found in .env. Creating test account via Ethereal Email...");
  const testAccount = await nodemailer.createTestAccount();
  cachedTransporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
  console.log("Created test Ethereal Email account:", testAccount.user);
  return cachedTransporter;
}

function formatAmount(amount: number): string {
  return amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export async function sendQuotationEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const { quotation, recipientEmail, subject, message } = options;
  const targetRecipient = recipientEmail || quotation.clientEmail;

  if (!targetRecipient) {
    throw new Error("Recipient email address is required.");
  }

  const transporter = await getTransporter();

  // Generate PDF buffer
  const pdfBuffer = await generateQuotationPdf(quotation);

  const senderUser = process.env.SMTP_USER || "devb4111@gmail.com";
  const fromAddress = process.env.SMTP_FROM || `"Surya Sangam" <${senderUser}>`;
  const emailSubject = subject || `Quotation ${quotation.quotationId} - Surya Sangam`;

  const customMessage = message ? message.trim() : "";
  const customMessageHtml = customMessage
    ? `<div style="background-color: #f1f5f9; border-left: 4px solid #16a34a; padding: 12px 16px; margin: 18px 0; color: #1e293b; font-size: 14px;">${customMessage.replace(
        /\r?\n/g,
        "<br/>"
      )}</div>`
    : "";

  // 1. Plain Text Alternative (CRITICAL for bypassing spam filters)
  const plainTextBody = `
Dear ${quotation.clientName},

Thank you for your interest in Surya Sangam. Please find attached the official quotation ${quotation.quotationId} dated ${quotation.quotationDate}.

${customMessage ? `${customMessage}\n\n` : ""}Quotation Details:
- Quotation ID: ${quotation.quotationId}
- Date: ${quotation.quotationDate}
- Line Items: ${quotation.items.length}
- Subtotal: INR ${formatAmount(quotation.subtotal)}
- GST / Tax (${quotation.taxRate}%): INR ${formatAmount(quotation.taxAmount)}
- Grand Total: INR ${formatAmount(quotation.grandTotal)}

The complete item breakdown, pricing, and terms & conditions are included in the attached PDF: Quotation-${quotation.quotationId}.pdf.

If you have any questions or require revisions, please reply directly to this email.

Warm regards,
Surya Sangam Team
Email: ${senderUser}
Website: Surya Sangam (Simple • Swift • Smart)
`.trim();

  // 2. High-Deliverability Responsive HTML Template
  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emailSubject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px 12px; line-height: 1.6;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <!-- Brand Header -->
          <tr>
            <td style="padding: 24px 32px; border-bottom: 2px solid #16a34a; background-color: #ffffff;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #0f172a; letter-spacing: 0.5px;">SURYA SANGAM</h1>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b; font-weight: 500; letter-spacing: 1px; text-transform: uppercase;">Simple • Swift • Smart</p>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 6px 12px; background-color: #f0fdf4; color: #15803d; border-radius: 6px; font-size: 13px; font-weight: 600; font-family: monospace;">${quotation.quotationId}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
                Dear <strong>${quotation.clientName}</strong>,
              </p>
              
              <p style="margin: 0 0 16px 0; font-size: 14px; color: #334155; line-height: 1.6;">
                Thank you for contacting Surya Sangam. We are pleased to provide you with our official quotation for your review.
              </p>

              ${customMessageHtml}

              <!-- Summary Card -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 20px 0; border: 1px solid #e2e8f0; border-radius: 6px; background-color: #f8fafc;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="6" style="font-size: 13.5px; color: #334155;">
                      <tr>
                        <td>Quotation Date:</td>
                        <td align="right" style="font-weight: 600; color: #0f172a;">${quotation.quotationDate}</td>
                      </tr>
                      <tr>
                        <td>Total Line Items:</td>
                        <td align="right" style="font-weight: 600; color: #0f172a;">${quotation.items.length}</td>
                      </tr>
                      <tr>
                        <td>Subtotal:</td>
                        <td align="right" style="font-weight: 600; color: #0f172a;">₹${formatAmount(quotation.subtotal)}</td>
                      </tr>
                      <tr>
                        <td>GST / Tax (${quotation.taxRate}%):</td>
                        <td align="right" style="font-weight: 600; color: #0f172a;">₹${formatAmount(quotation.taxAmount)}</td>
                      </tr>
                      <tr style="border-top: 1px solid #cbd5e1;">
                        <td style="padding-top: 10px; font-size: 15px; font-weight: 700; color: #0f172a;">Grand Total:</td>
                        <td align="right" style="padding-top: 10px; font-size: 16px; font-weight: 700; color: #15803d;">₹${formatAmount(quotation.grandTotal)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Attachment Note -->
              <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 12px 16px; margin: 20px 0; font-size: 13px; color: #1e40af;">
                📎 <strong>PDF Document Attached:</strong> The complete quotation with detailed specifications, itemized unit prices, and commercial terms is attached as <code>Quotation-${quotation.quotationId}.pdf</code>.
              </div>

              <p style="margin: 20px 0 0 0; font-size: 14px; color: #334155;">
                If you have any questions or would like to discuss adjustments, simply reply directly to this email or reach us at <a href="mailto:${senderUser}" style="color: #16a34a; text-decoration: none; font-weight: 500;">${senderUser}</a>.
              </p>

              <p style="margin: 24px 0 0 0; font-size: 14px; color: #0f172a;">
                Warm regards,<br>
                <strong>Surya Sangam Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f1f5f9; border-top: 1px solid #e2e8f0; font-size: 11.5px; color: #64748b; line-height: 1.5; text-align: center;">
              This email was generated for <strong>${quotation.clientName}</strong> (${targetRecipient}).<br>
              Surya Sangam • Simple • Swift • Smart • Confidential Quotation Document
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  const mailOptions = {
    from: fromAddress,
    to: targetRecipient,
    replyTo: senderUser,
    subject: emailSubject,
    text: plainTextBody,
    html: htmlBody,
    attachments: [
      {
        filename: `Quotation-${quotation.quotationId}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  };

  const info = await transporter.sendMail(mailOptions);
  const previewUrl = nodemailer.getTestMessageUrl(info);

  return {
    success: true,
    messageId: info.messageId,
    previewUrl,
    recipient: targetRecipient,
    message: `Quotation PDF sent successfully to ${targetRecipient}`,
  };
}
