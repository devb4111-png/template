"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, Download, Save, RefreshCw, Eye, CheckCircle2, AlertCircle, Mail } from "lucide-react";
import { Quotation, QuotationFormData, QuotationItem } from "../types/quotation";
import {
  createQuotation,
  updateQuotation,
  previewQuotationPdf,
  downloadQuotationPdf,
  sendSavedQuotationEmail,
  sendFormQuotationEmail,
} from "../services/api";
import EmailModal from "./EmailModal";

interface Props {
  initialData?: Quotation | null;
  onSaved: () => void;
  onReset: () => void;
}

const DEFAULT_TERMS = [
  "Quotation validity: 30 days.",
  "Installation and warranty: as specified in the final agreement.",
  "Payment schedule: as agreed with the customer.",
];

function generateNewQuotationId(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `QT-${year}-${random}`;
}

function getTodayString(): string {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

export default function QuotationForm({ initialData, onSaved, onReset }: Props) {
  const [quotationId, setQuotationId] = useState(generateNewQuotationId());
  const [quotationDate, setQuotationDate] = useState(getTodayString());
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [taxRate, setTaxRate] = useState<number>(18);
  const [terms, setTerms] = useState<string[]>(DEFAULT_TERMS);

  const [items, setItems] = useState<QuotationItem[]>([
    { itemName: "", quantity: 1, unitPrice: 0 },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync form when initialData changes (e.g. user selects a saved quotation to edit)
  useEffect(() => {
    if (initialData) {
      setQuotationId(initialData.quotationId);
      setQuotationDate(initialData.quotationDate);
      setClientName(initialData.clientName);
      setClientEmail(initialData.clientEmail);
      setClientAddress(initialData.clientAddress);
      setTaxRate(initialData.taxRate ?? 18);
      setTerms(initialData.terms && initialData.terms.length > 0 ? initialData.terms : DEFAULT_TERMS);
      setItems(
        initialData.items.map((it) => ({
          itemName: it.itemName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        }))
      );
    } else {
      resetForm();
    }
  }, [initialData]);

  const resetForm = () => {
    setQuotationId(generateNewQuotationId());
    setQuotationDate(getTodayString());
    setClientName("");
    setClientEmail("");
    setClientAddress("");
    setTaxRate(18);
    setTerms(DEFAULT_TERMS);
    setItems([{ itemName: "", quantity: 1, unitPrice: 0 }]);
    setSuccessMessage(null);
    setErrorMessage(null);
    onReset();
  };

  const addItemRow = () => {
    setItems((prev) => [...prev, { itemName: "", quantity: 1, unitPrice: 0 }]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) {
      setErrorMessage("At least one item row is required.");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof QuotationItem, value: any) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const updateTerm = (index: number, value: string) => {
    setTerms((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const addTerm = () => {
    setTerms((prev) => [...prev, ""]);
  };

  const removeTerm = (index: number) => {
    setTerms((prev) => prev.filter((_, i) => i !== index));
  };

  // Live client-side calculation (backend validates & recalculates on submission)
  const subtotal = items.reduce((acc, curr) => {
    const q = Number(curr.quantity) || 0;
    const p = Number(curr.unitPrice) || 0;
    return acc + q * p;
  }, 0);
  const taxAmount = (subtotal * (Number(taxRate) || 0)) / 100;
  const grandTotal = subtotal + taxAmount;

  const formatCurrency = (val: number) => {
    return val.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getFormData = (): QuotationFormData => ({
    quotationId: quotationId.trim(),
    quotationDate,
    clientName: clientName.trim(),
    clientEmail: clientEmail.trim(),
    clientAddress: clientAddress.trim(),
    taxRate: Number(taxRate) || 0,
    items: items.map((it) => ({
      itemName: it.itemName.trim(),
      quantity: Number(it.quantity) || 1,
      unitPrice: Number(it.unitPrice) || 0,
    })),
    terms: terms.filter((t) => t.trim().length > 0),
  });

  const validateForm = (): boolean => {
    if (!quotationId.trim()) {
      setErrorMessage("Quotation ID is required.");
      return false;
    }
    if (!clientName.trim()) {
      setErrorMessage("Client Name is required.");
      return false;
    }
    if (!clientEmail.trim() || !clientEmail.includes("@")) {
      setErrorMessage("A valid Client Email is required.");
      return false;
    }
    if (!clientAddress.trim()) {
      setErrorMessage("Client Address is required.");
      return false;
    }
    if (items.length === 0) {
      setErrorMessage("At least one quotation item is required.");
      return false;
    }
    for (let i = 0; i < items.length; i++) {
      if (!items[i].itemName.trim()) {
        setErrorMessage(`Item #${i + 1} description is empty.`);
        return false;
      }
      if (items[i].quantity <= 0) {
        setErrorMessage(`Item #${i + 1} quantity must be greater than 0.`);
        return false;
      }
      if (items[i].unitPrice < 0) {
        setErrorMessage(`Item #${i + 1} unit price cannot be negative.`);
        return false;
      }
    }
    setErrorMessage(null);
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const data = getFormData();
      if (initialData?._id) {
        await updateQuotation(initialData._id, data);
        setSuccessMessage(`Quotation "${quotationId}" updated successfully!`);
      } else {
        await createQuotation(data);
        setSuccessMessage(`Quotation "${quotationId}" saved to MongoDB!`);
      }
      onSaved();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save quotation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePreviewPdf = async () => {
    if (!validateForm()) return;

    setIsPreviewing(true);
    setErrorMessage(null);

    try {
      const data = getFormData();
      const previewUrl = await previewQuotationPdf(data);
      window.open(previewUrl, "_blank");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to preview PDF");
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!validateForm()) return;

    setIsDownloading(true);
    setErrorMessage(null);

    try {
      const data = getFormData();
      // If quotation is saved in DB, use ID, else preview endpoint as download
      if (initialData?._id) {
        await downloadQuotationPdf(initialData._id, `Quotation-${quotationId}.pdf`);
      } else {
        // First save or preview blob download
        const url = await previewQuotationPdf(data);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Quotation-${quotationId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to download PDF");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenEmailModal = () => {
    if (!validateForm()) return;
    setIsEmailModalOpen(true);
  };

  const handleSendEmail = async (payload: {
    recipientEmail: string;
    subject: string;
    message: string;
  }) => {
    const data = getFormData();
    if (initialData?._id) {
      return await sendSavedQuotationEmail(initialData._id, payload);
    } else {
      return await sendFormQuotationEmail(data, payload);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Form Header */}
      <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            {initialData ? `Editing Quotation: ${initialData.quotationId}` : "Create New Quotation"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Fill the fields below to populate the official Surya Sangam quotation template.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Reset
          </button>
          <button
            type="button"
            onClick={handlePreviewPdf}
            disabled={isPreviewing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-sm"
          >
            <Eye className="w-4 h-4 text-slate-600" />
            {isPreviewing ? "Generating..." : "Preview"}
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition shadow-sm"
          >
            <Download className="w-4 h-4" />
            {isDownloading ? "Downloading..." : "PDF"}
          </button>
          <button
            type="button"
            onClick={handleOpenEmailModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-sm"
          >
            <Mail className="w-4 h-4 text-emerald-600" />
            Send Email
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition shadow-sm"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? "Saving..." : initialData ? "Update" : "Save"}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="m-6 p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm font-medium text-emerald-800">{successMessage}</div>
        </div>
      )}

      {errorMessage && (
        <div className="m-6 p-4 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-sm font-medium text-rose-800">{errorMessage}</div>
        </div>
      )}

      {/* Form Content */}
      <div className="p-6 space-y-8">
        {/* Section 1: Quotation Details */}
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">
            Quotation Identification & Date
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
                Quotation ID *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={quotationId}
                  onChange={(e) => setQuotationId(e.target.value)}
                  placeholder="e.g. QT-2026-0001"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  title="Generate new ID"
                  onClick={() => setQuotationId(generateNewQuotationId())}
                  className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 text-xs font-semibold"
                >
                  Gen
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
                Quotation Date *
              </label>
              <input
                type="date"
                value={quotationDate}
                onChange={(e) => setQuotationDate(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
                GST / Tax Rate (%)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Client Information */}
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">
            Prepared For (Client Information)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
                Client Name / Company *
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Rajesh Kumar or Zenith Solar Enterprises"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
                Client Email *
              </label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="e.g. rajesh@example.com"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
                Client Address *
              </label>
              <textarea
                rows={2}
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder="e.g. Plot No. 45, Industrial Area, Sector 5, New Delhi 110001"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Dynamic Quotation Items Table */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Quotation Items
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Add, remove, or modify line items. The backend calculates precise totals.
              </p>
            </div>
            <button
              type="button"
              onClick={addItemRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Item Row
            </button>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 w-28 text-center">Qty</th>
                  <th className="py-3 px-4 w-36 text-right">Unit Price (₹)</th>
                  <th className="py-3 px-4 w-36 text-right">Amount (₹)</th>
                  <th className="py-3 px-3 w-16 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {items.map((item, idx) => {
                  const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-4 text-center font-medium text-slate-400 text-xs">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-4">
                        <textarea
                          rows={1}
                          value={item.itemName}
                          onChange={(e) => updateItem(idx, "itemName", e.target.value)}
                          placeholder="e.g. Mono Perc Solar Panel 540W"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-none resize-y"
                        />
                      </td>
                      <td className="py-2.5 px-4">
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(idx, "quantity", parseFloat(e.target.value) || 0)
                          }
                          className="w-full text-center px-2 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        />
                      </td>
                      <td className="py-2.5 px-4">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateItem(idx, "unitPrice", parseFloat(e.target.value) || 0)
                          }
                          className="w-full text-right px-2 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        />
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-700">
                        ₹{formatCurrency(lineTotal)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          title="Remove item"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 4: Totals & Terms */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4 border-t border-slate-200">
          {/* Terms & Conditions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-slate-600 uppercase">
                Terms and Conditions
              </label>
              <button
                type="button"
                onClick={addTerm}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              >
                + Add Clause
              </button>
            </div>
            <div className="space-y-2">
              {terms.map((term, tIdx) => (
                <div key={tIdx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={term}
                    onChange={(e) => updateTerm(tIdx, e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                  {terms.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTerm(tIdx)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition"
                      title="Remove clause"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Totals Summary Card */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200/80 space-y-3">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Summary Calculation
            </h4>
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal:</span>
              <span className="font-semibold text-slate-800">₹{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>GST / Tax ({taxRate}%):</span>
              <span className="font-semibold text-slate-800">₹{formatCurrency(taxAmount)}</span>
            </div>
            <div className="pt-3 border-t border-slate-200 flex justify-between text-base font-bold text-slate-900">
              <span>Grand Total:</span>
              <span className="text-emerald-700">₹{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      <EmailModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        quotationId={quotationId}
        defaultRecipient={clientEmail}
        defaultSubject={`Quotation ${quotationId} from Surya Sangam`}
        onSend={handleSendEmail}
      />
    </div>
  );
}
