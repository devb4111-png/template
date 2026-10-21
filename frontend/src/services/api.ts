import { Quotation, QuotationFormData, TemplateInfo } from "../types/quotation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export async function fetchTemplates(): Promise<TemplateInfo[]> {
  try {
    const res = await fetch(`${API_BASE}/quotations/templates`, { cache: "no-store" });
    if (!res.ok) {
      return [];
    }
    const data = await res.json();
    return data.templates || [];
  } catch (err) {
    console.warn("Failed to fetch template list from backend, using default fallback:", err);
    return [
      {
        id: "t2",
        name: "Surya Sangam Official Canva Design (t2)",
        description: "Official Surya Sangam minimalist design with dark accent divider bars",
        fileName: "t2.pdf",
        isDefault: true,
      },
      {
        id: "t3",
        name: "Solar Technical & Pricing Specification (t3)",
        description: "Detailed solar quotation with bank account and warranty layout",
        fileName: "t3.pdf",
        isDefault: false,
      },
      {
        id: "t2-html",
        name: "Surya Sangam HTML Engine (Canva Fidelity)",
        description: "Puppeteer-based pixel-faithful rendering for custom printing",
        fileName: "html",
        isDefault: false,
      },
    ];
  }
}

export async function fetchQuotations(): Promise<Quotation[]> {
  const res = await fetch(`${API_BASE}/quotations`, { cache: "no-store" });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to fetch quotations");
  }
  const data = await res.json();
  return data.quotations || [];
}

export async function getQuotation(id: string): Promise<Quotation> {
  const res = await fetch(`${API_BASE}/quotations/${id}`, { cache: "no-store" });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to fetch quotation");
  }
  const data = await res.json();
  return data.quotation;
}

export async function createQuotation(formData: QuotationFormData): Promise<Quotation> {
  const res = await fetch(`${API_BASE}/quotations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    let msg = errorData.error || "Failed to create quotation";
    if (errorData.details) {
      const detailsList = Object.entries(errorData.details)
        .map(([field, errs]) => `${field}: ${(errs as string[]).join(", ")}`)
        .join("; ");
      msg += ` (${detailsList})`;
    }
    throw new Error(msg);
  }

  const data = await res.json();
  return data.quotation;
}

export async function updateQuotation(id: string, formData: QuotationFormData): Promise<Quotation> {
  const res = await fetch(`${API_BASE}/quotations/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    let msg = errorData.error || "Failed to update quotation";
    if (errorData.details) {
      const detailsList = Object.entries(errorData.details)
        .map(([field, errs]) => `${field}: ${(errs as string[]).join(", ")}`)
        .join("; ");
      msg += ` (${detailsList})`;
    }
    throw new Error(msg);
  }

  const data = await res.json();
  return data.quotation;
}

export async function deleteQuotation(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/quotations/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to delete quotation");
  }
}

export async function downloadQuotationPdf(
  idOrQuotationId: string,
  downloadName?: string,
  templateId?: string
): Promise<void> {
  const queryParam = templateId ? `?templateId=${encodeURIComponent(templateId)}` : "";
  const res = await fetch(`${API_BASE}/quotations/${idOrQuotationId}/pdf${queryParam}`);
  if (!res.ok) {
    throw new Error("Failed to generate PDF for download");
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = downloadName || `Quotation-${idOrQuotationId}.pdf`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function previewQuotationPdf(
  formData: QuotationFormData,
  templateId?: string
): Promise<string> {
  const payload = {
    ...formData,
    templateId: templateId || formData.templateId || "t2",
  };

  const res = await fetch(`${API_BASE}/quotations/preview-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to generate preview PDF");
  }

  const blob = await res.blob();
  return window.URL.createObjectURL(blob);
}

export interface EmailPayload {
  recipientEmail?: string;
  subject?: string;
  message?: string;
  templateId?: string;
}

export interface EmailResponse {
  success: boolean;
  message: string;
  recipient: string;
  previewUrl?: string | false;
}

export async function sendSavedQuotationEmail(
  id: string,
  payload: EmailPayload
): Promise<EmailResponse> {
  const res = await fetch(`${API_BASE}/quotations/${id}/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to send email");
  }

  return await res.json();
}

export async function sendFormQuotationEmail(
  formData: QuotationFormData,
  payload: EmailPayload
): Promise<EmailResponse> {
  const res = await fetch(`${API_BASE}/quotations/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quotationData: formData,
      recipientEmail: payload.recipientEmail,
      subject: payload.subject,
      message: payload.message,
      templateId: payload.templateId || formData.templateId,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to send email");
  }

  return await res.json();
}

export async function checkSmtpStatus(): Promise<{
  isConfigured: boolean;
  host: string | null;
  from: string | null;
}> {
  try {
    const res = await fetch(`${API_BASE}/quotations/smtp-status`, { cache: "no-store" });
    if (!res.ok) {
      return { isConfigured: false, host: null, from: null };
    }
    return await res.json();
  } catch {
    return { isConfigured: false, host: null, from: null };
  }
}


