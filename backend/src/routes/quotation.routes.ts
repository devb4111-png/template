import { Router, Request, Response } from "express";
import { QuotationInputSchema } from "../validation/quotation.schema";
import { calculateQuotation } from "../services/calculation.service";
import { Quotation } from "../models/Quotation";
import { generateQuotationPdf } from "../services/pdf.service";
import { sendQuotationEmail } from "../services/email.service";
import { getApprovedTemplatesList, isValidTemplateId } from "../config/pdfMap.config";

const router = Router();

// GET /api/quotations/smtp-status - Check if real SMTP server is configured
router.get("/smtp-status", (req: Request, res: Response) => {
  const isConfigured = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  );
  return res.json({
    isConfigured,
    host: process.env.SMTP_HOST || null,
    from: process.env.SMTP_FROM || process.env.SMTP_USER || null,
  });
});

// POST /api/quotations - Create and save a new quotation
router.post("/", async (req: Request, res: Response) => {
  try {
    const parseResult = QuotationInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    // Check duplicate quotationId
    const existing = await Quotation.findOne({ quotationId: parseResult.data.quotationId });
    if (existing) {
      return res.status(409).json({
        error: `Quotation with ID "${parseResult.data.quotationId}" already exists.`,
      });
    }

    const calculated = calculateQuotation(parseResult.data);
    const quotation = new Quotation(calculated);
    await quotation.save();

    return res.status(201).json({
      message: "Quotation created successfully",
      quotation,
    });
  } catch (err: any) {
    console.error("Error creating quotation:", err);
    return res.status(500).json({ error: "Failed to create quotation", message: err.message });
  }
});

// GET /api/quotations - List all quotations
router.get("/", async (req: Request, res: Response) => {
  try {
    const quotations = await Quotation.find().sort({ updatedAt: -1 });
    return res.json({ quotations });
  } catch (err: any) {
    console.error("Error fetching quotations:", err);
    return res.status(500).json({ error: "Failed to fetch quotations", message: err.message });
  }
});

// GET /api/quotations/templates - List approved PDF templates (must be declared before /:id)
router.get("/templates", (req: Request, res: Response) => {
  return res.json({
    templates: getApprovedTemplatesList(),
  });
});

// GET /api/quotations/:id - Get quotation by ID or quotationId
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    let quotation = null;
    if (id && id.match(/^[0-9a-fA-F]{24}$/)) {
      quotation = await Quotation.findById(id);
    }
    if (!quotation) {
      quotation = await Quotation.findOne({ quotationId: id });
    }

    if (!quotation) {
      return res.status(404).json({ error: "Quotation not found" });
    }

    return res.json({ quotation });
  } catch (err: any) {
    console.error("Error retrieving quotation:", err);
    return res.status(500).json({ error: "Failed to retrieve quotation", message: err.message });
  }
});

// PUT /api/quotations/:id - Update quotation
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const parseResult = QuotationInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    let query: any = { quotationId: id };
    if (id && id.match(/^[0-9a-fA-F]{24}$/)) {
      query = { _id: id };
    }

    const calculated = calculateQuotation(parseResult.data);
    const updated = await Quotation.findOneAndUpdate(query, calculated, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ error: "Quotation not found to update" });
    }

    return res.json({
      message: "Quotation updated successfully",
      quotation: updated,
    });
  } catch (err: any) {
    console.error("Error updating quotation:", err);
    return res.status(500).json({ error: "Failed to update quotation", message: err.message });
  }
});

// DELETE /api/quotations/:id - Delete quotation
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    let query: any = { quotationId: id };
    if (id && id.match(/^[0-9a-fA-F]{24}$/)) {
      query = { _id: id };
    }

    const deleted = await Quotation.findOneAndDelete(query);
    if (!deleted) {
      return res.status(404).json({ error: "Quotation not found" });
    }

    return res.json({ message: "Quotation deleted successfully" });
  } catch (err: any) {
    console.error("Error deleting quotation:", err);
    return res.status(500).json({ error: "Failed to delete quotation", message: err.message });
  }
});

// POST /api/quotations/generate-pdf - Generate downloadable PDF per Phase 2 specification
router.post("/generate-pdf", async (req: Request, res: Response) => {
  try {
    const rawTemplateId =
      req.body.templateId ||
      req.body.quotation?.templateId ||
      (req.query.templateId as string);
    const templateId = rawTemplateId || "t2";

    if (rawTemplateId && !isValidTemplateId(rawTemplateId)) {
      return res.status(400).json({
        error: `Invalid templateId: "${rawTemplateId}".`,
        availableTemplates: getApprovedTemplatesList().map((t) => t.id),
      });
    }

    // Support both { templateId, quotation: { ... } } and direct { templateId, ...quotation }
    const quotationPayload = req.body.quotation ? req.body.quotation : req.body;
    const parseResult = QuotationInputSchema.safeParse(quotationPayload);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation failed for quotation data",
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const calculated = calculateQuotation({
      ...parseResult.data,
      templateId,
    });
    const pdfBuffer = await generateQuotationPdf(calculated, templateId);

    const safeQuotationId = calculated.quotationId.replace(/[^a-zA-Z0-9_-]/g, "_");
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Quotation-${safeQuotationId}.pdf"`,
      "Content-Length": pdfBuffer.length.toString(),
    });

    return res.send(pdfBuffer);
  } catch (err: any) {
    console.error("Error generating quotation PDF:", err);
    return res.status(500).json({ error: "Failed to generate PDF", message: err.message });
  }
});

// POST /api/quotations/preview-pdf - Generate PDF from submitted data directly
router.post("/preview-pdf", async (req: Request, res: Response) => {
  try {
    const rawTemplateId =
      req.body.templateId ||
      req.body.quotation?.templateId ||
      (req.query.templateId as string);
    const templateId = rawTemplateId || "t2";
    if (rawTemplateId && !isValidTemplateId(rawTemplateId)) {
      return res.status(400).json({
        error: `Invalid templateId: "${rawTemplateId}".`,
        availableTemplates: getApprovedTemplatesList().map((t) => t.id),
      });
    }

    const quotationPayload = req.body.quotation ? req.body.quotation : req.body;
    const parseResult = QuotationInputSchema.safeParse(quotationPayload);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const calculated = calculateQuotation({
      ...parseResult.data,
      templateId,
    });
    const pdfBuffer = await generateQuotationPdf(calculated, templateId);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Quotation-${calculated.quotationId}.pdf"`,
      "Content-Length": pdfBuffer.length.toString(),
    });

    return res.send(pdfBuffer);
  } catch (err: any) {
    console.error("Error generating preview PDF:", err);
    return res.status(500).json({ error: "Failed to generate PDF", message: err.message });
  }
});

// GET /api/quotations/:id/pdf - Generate and download PDF for saved quotation
router.get("/:id/pdf", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    let quotation = null;
    if (id && id.match(/^[0-9a-fA-F]{24}$/)) {
      quotation = await Quotation.findById(id);
    }
    if (!quotation) {
      quotation = await Quotation.findOne({ quotationId: id });
    }

    if (!quotation) {
      return res.status(404).json({ error: "Quotation not found" });
    }

    const templateId = (req.query.templateId as string) || quotation.templateId || "t2";

    if (templateId && !isValidTemplateId(templateId)) {
      return res.status(400).json({
        error: `Invalid templateId: "${templateId}".`,
        availableTemplates: getApprovedTemplatesList().map((t) => t.id),
      });
    }

    const calculated = calculateQuotation({
      templateId,
      quotationId: quotation.quotationId,
      quotationDate: quotation.quotationDate,
      clientName: quotation.clientName,
      clientAddress: quotation.clientAddress,
      clientEmail: quotation.clientEmail,
      clientPhone: quotation.clientPhone,
      contactPerson: quotation.contactPerson,
      companyDetails: quotation.companyDetails,
      items: quotation.items.map((it) => ({
        itemName: it.itemName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      })),
      taxRate: quotation.taxRate,
      terms: quotation.terms,
    });

    const pdfBuffer = await generateQuotationPdf(calculated, templateId);

    const safeQuotationId = quotation.quotationId.replace(/[^a-zA-Z0-9_-]/g, "_");
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Quotation-${safeQuotationId}.pdf"`,
      "Content-Length": pdfBuffer.length.toString(),
    });

    return res.send(pdfBuffer);
  } catch (err: any) {
    console.error("Error generating quotation PDF:", err);
    return res.status(500).json({ error: "Failed to generate PDF", message: err.message });
  }
});

// POST /api/quotations/:id/send-email - Send saved quotation directly to recipient email
router.post("/:id/send-email", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { recipientEmail, subject, message, templateId } = req.body;

    let quotation = null;
    if (id && id.match(/^[0-9a-fA-F]{24}$/)) {
      quotation = await Quotation.findById(id);
    }
    if (!quotation) {
      quotation = await Quotation.findOne({ quotationId: id });
    }

    if (!quotation) {
      return res.status(404).json({ error: "Quotation not found" });
    }

    const calculated = calculateQuotation({
      templateId: quotation.templateId || "t2",
      quotationId: quotation.quotationId,
      quotationDate: quotation.quotationDate,
      clientName: quotation.clientName,
      clientAddress: quotation.clientAddress,
      clientEmail: quotation.clientEmail,
      clientPhone: quotation.clientPhone,
      contactPerson: quotation.contactPerson,
      companyDetails: quotation.companyDetails,
      items: quotation.items.map((it) => ({
        itemName: it.itemName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      })),
      taxRate: quotation.taxRate,
      terms: quotation.terms,
    });

    const result = await sendQuotationEmail({
      quotation: calculated,
      recipientEmail,
      subject,
      message,
      templateId,
    });

    return res.json({
      success: true,
      message: result.message,
      recipient: result.recipient,
      previewUrl: result.previewUrl,
    });
  } catch (err: any) {
    console.error("Error sending quotation email:", err);
    return res.status(500).json({ error: "Failed to send email", message: err.message });
  }
});

// POST /api/quotations/send-email - Send quotation directly from form data without saving
router.post("/send-email", async (req: Request, res: Response) => {
  try {
    const { quotationData, recipientEmail, subject, message, templateId } = req.body;
    const parseResult = QuotationInputSchema.safeParse(quotationData || req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const calculated = calculateQuotation(parseResult.data);
    const chosenTemplate = templateId || quotationData?.templateId;

    const result = await sendQuotationEmail({
      quotation: calculated,
      recipientEmail,
      subject,
      message,
      templateId: chosenTemplate,
    });

    return res.json({
      success: true,
      message: result.message,
      recipient: result.recipient,
      previewUrl: result.previewUrl,
    });
  } catch (err: any) {
    console.error("Error sending quotation email:", err);
    return res.status(500).json({ error: "Failed to send email", message: err.message });
  }
});

export default router;
