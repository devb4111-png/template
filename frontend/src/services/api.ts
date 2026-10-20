import { Quotation, QuotationFormData } from "../types/quotation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

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

export async function downloadQuotationPdf(idOrQuotationId: string, downloadName?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/quotations/${idOrQuotationId}/pdf`);
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

export async function previewQuotationPdf(formData: QuotationFormData): Promise<string> {
  const res = await fetch(`${API_BASE}/quotations/preview-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData),
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


