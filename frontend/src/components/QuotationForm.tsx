"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Download,
  Save,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  Mail,
  FileText,
  Building2,
  User,
  Landmark,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Quotation, QuotationFormData, QuotationItem, TemplateInfo } from "../types/quotation";
import {
  createQuotation,
  updateQuotation,
  previewQuotationPdf,
  downloadQuotationPdf,
  sendSavedQuotationEmail,
  sendFormQuotationEmail,
  fetchTemplates,
} from "../services/api";
import EmailModal from "./EmailModal";

interface Props {
  initialData?: Quotation | null;
  onSaved: () => void;
  onReset: () => void;
}

const DEFAULT_COMPANY = {
  name: "Surya Sangam Renewable Energy Pvt Ltd",
  phone: "+91 98765 43210",
  email: "info@suryasangam.com",
  gstin: "07AAAAA0000A1Z5",
  address: "Sector 62, Electronic City, Noida, UP 201309",
  website: "www.suryasangam.com",
  bankName: "HDFC Bank Ltd",
  accountHolder: "Surya Sangam Renewable Energy Pvt Ltd",
  accountNumber: "50200012345678",
  ifscCode: "HDFC0001234",
  branch: "Noida Sector 62 Branch",
};

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
  const [taxRate, setTaxRate] = useState<number>(18);
  const [terms, setTerms] = useState<string[]>(DEFAULT_TERMS);

  // 1. Company Details State (Your Business / Provider)
  const [companyName, setCompanyName] = useState(DEFAULT_COMPANY.name);
  const [companyPhone, setCompanyPhone] = useState(DEFAULT_COMPANY.phone);
  const [companyEmail, setCompanyEmail] = useState(DEFAULT_COMPANY.email);
  const [companyGstin, setCompanyGstin] = useState(DEFAULT_COMPANY.gstin);
  const [companyAddress, setCompanyAddress] = useState(DEFAULT_COMPANY.address);
  const [companyWebsite, setCompanyWebsite] = useState(DEFAULT_COMPANY.website);

  // Company Bank Account Details State
  const [bankAccountHolder, setBankAccountHolder] = useState(DEFAULT_COMPANY.accountHolder);
  const [bankName, setBankName] = useState(DEFAULT_COMPANY.bankName);
  const [bankAccountNumber, setBankAccountNumber] = useState(DEFAULT_COMPANY.accountNumber);
  const [bankIfsc, setBankIfsc] = useState(DEFAULT_COMPANY.ifscCode);
  const [bankBranch, setBankBranch] = useState(DEFAULT_COMPANY.branch);
  const [showBankDetails, setShowBankDetails] = useState(false);

  // 2. Customer / Client Details State (Recipient)
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [contactPerson, setContactPerson] = useState("");

  // Row 2 and Row 3 Data Entries State
  const [row2Description, setRow2Description] = useState("Product / service and specifications");
  const [row2UnitPrice, setRow2UnitPrice] = useState<number | string>(0);
  const [row2Quantity, setRow2Quantity] = useState<number | string>(1);
  const [row3Description, setRow3Description] = useState("Installation / other charges, if applicable");
  const [row3UnitPrice, setRow3UnitPrice] = useState<number | string>(0);
  const [row3Quantity, setRow3Quantity] = useState<number | string>(1);

  const [items, setItems] = useState<QuotationItem[]>([
    { itemName: "", quantity: 1, unitPrice: 0 },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [selectedTemplate, setSelectedTemplate] = useState<string>("t2");
  const [availableTemplates, setAvailableTemplates] = useState<TemplateInfo[]>([
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
      description: "Detailed solar quotation with separate company, customer, bank and warranty sections",
      fileName: "t3.pdf",
      isDefault: false,
    },
    {
      id: "t4",
      name: "Product Specifications & Pricing (t4)",
      description: "Product specifications and pricing template with automatic GST calculation",
      fileName: "t4.pdf",
      isDefault: false,
    },
    {
      id: "t2-html",
      name: "Surya Sangam HTML Engine (Canva Fidelity)",
      description: "Puppeteer-based pixel-faithful rendering",
      fileName: "html",
      isDefault: false,
    },
  ]);

  // Load available templates from backend
  useEffect(() => {
    fetchTemplates().then((tpls) => {
      if (tpls && tpls.length > 0) {
        setAvailableTemplates(tpls);
      }
    });
  }, []);

  // Sync form when initialData changes (e.g. user selects a saved quotation to edit)
  useEffect(() => {
    if (initialData) {
      setQuotationId(initialData.quotationId);
      setQuotationDate(initialData.quotationDate);
      setClientName(initialData.clientName);
      setClientEmail(initialData.clientEmail);
      setClientAddress(initialData.clientAddress);
      setClientPhone(initialData.clientPhone || "");
      setContactPerson(initialData.contactPerson || "");
      setTaxRate(initialData.taxRate ?? 18);
      setTerms(initialData.terms && initialData.terms.length > 0 ? initialData.terms : DEFAULT_TERMS);
      if (initialData.templateId) {
        setSelectedTemplate(initialData.templateId);
      }

      if (initialData.companyDetails) {
        setCompanyName(initialData.companyDetails.name || DEFAULT_COMPANY.name);
        setCompanyPhone(initialData.companyDetails.phone || DEFAULT_COMPANY.phone);
        setCompanyEmail(initialData.companyDetails.email || DEFAULT_COMPANY.email);
        setCompanyGstin(initialData.companyDetails.gstin || DEFAULT_COMPANY.gstin);
        setCompanyAddress(initialData.companyDetails.address || DEFAULT_COMPANY.address);
        setCompanyWebsite(initialData.companyDetails.website || DEFAULT_COMPANY.website);
        setBankName(initialData.companyDetails.bankName || DEFAULT_COMPANY.bankName);
        setBankAccountHolder(initialData.companyDetails.accountHolder || DEFAULT_COMPANY.accountHolder);
        setBankAccountNumber(initialData.companyDetails.accountNumber || DEFAULT_COMPANY.accountNumber);
        setBankIfsc(initialData.companyDetails.ifscCode || DEFAULT_COMPANY.ifscCode);
        setBankBranch(initialData.companyDetails.branch || DEFAULT_COMPANY.branch);
      }

      if (initialData.row2Description !== undefined) setRow2Description(initialData.row2Description);
      if (initialData.row2UnitPrice !== undefined) setRow2UnitPrice(initialData.row2UnitPrice);
      if (initialData.row2Quantity !== undefined) setRow2Quantity(initialData.row2Quantity);
      if (initialData.row3Description !== undefined) setRow3Description(initialData.row3Description);
      if (initialData.row3UnitPrice !== undefined) setRow3UnitPrice(initialData.row3UnitPrice);
      if (initialData.row3Quantity !== undefined) setRow3Quantity(initialData.row3Quantity);

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
    setCompanyName(DEFAULT_COMPANY.name);
    setCompanyPhone(DEFAULT_COMPANY.phone);
    setCompanyEmail(DEFAULT_COMPANY.email);
    setCompanyGstin(DEFAULT_COMPANY.gstin);
    setCompanyAddress(DEFAULT_COMPANY.address);
    setCompanyWebsite(DEFAULT_COMPANY.website);
    setBankName(DEFAULT_COMPANY.bankName);
    setBankAccountHolder(DEFAULT_COMPANY.accountHolder);
    setBankAccountNumber(DEFAULT_COMPANY.accountNumber);
    setBankIfsc(DEFAULT_COMPANY.ifscCode);
    setBankBranch(DEFAULT_COMPANY.branch);
    setShowBankDetails(false);

    setClientName("");
    setClientEmail("");
    setClientAddress("");
    setClientPhone("");
    setContactPerson("");
    setRow2Description("Product / service and specifications");
    setRow2UnitPrice(0);
    setRow2Quantity(1);
    setRow3Description("Installation / other charges, if applicable");
    setRow3UnitPrice(0);
    setRow3Quantity(1);
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
  const itemsSubtotal = items.reduce((acc, curr) => {
    const q = Number(curr.quantity) || 0;
    const p = Number(curr.unitPrice) || 0;
    return acc + q * p;
  }, 0);
  const r2Sub = selectedTemplate === "t4" ? ((Number(row2UnitPrice) || 0) * (Number(row2Quantity) || 1)) : 0;
  const r3Sub = selectedTemplate === "t4" ? ((Number(row3UnitPrice) || 0) * (Number(row3Quantity) || 1)) : 0;
  const subtotal = itemsSubtotal + r2Sub + r3Sub;
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
    clientPhone: clientPhone.trim() || undefined,
    contactPerson: contactPerson.trim() || undefined,
    companyDetails: {
      name: companyName.trim(),
      phone: companyPhone.trim(),
      email: companyEmail.trim(),
      gstin: companyGstin.trim(),
      address: companyAddress.trim(),
      website: companyWebsite.trim(),
      bankName: bankName.trim(),
      accountHolder: bankAccountHolder.trim(),
      accountNumber: bankAccountNumber.trim(),
      ifscCode: bankIfsc.trim(),
      branch: bankBranch.trim(),
    },
    taxRate: Number(taxRate) || 0,
    items: items.map((it) => ({
      itemName: it.itemName.trim(),
      quantity: Number(it.quantity) || 1,
      unitPrice: Number(it.unitPrice) || 0,
    })),
    row2Description: selectedTemplate === "t4" ? (row2Description.trim() || undefined) : undefined,
    row2UnitPrice: selectedTemplate === "t4" ? (Number(row2UnitPrice) || 0) : undefined,
    row2Quantity: selectedTemplate === "t4" ? (Number(row2Quantity) || 1) : undefined,
    row3Description: selectedTemplate === "t4" ? (row3Description.trim() || undefined) : undefined,
    row3UnitPrice: selectedTemplate === "t4" ? (Number(row3UnitPrice) || 0) : undefined,
    row3Quantity: selectedTemplate === "t4" ? (Number(row3Quantity) || 1) : undefined,
    terms: terms.filter((t) => t.trim().length > 0),
    templateId: selectedTemplate,
  });

  const validateForm = (): boolean => {
    if (!quotationId.trim()) {
      setErrorMessage("Quotation ID is required.");
      return false;
    }
    if (!companyName.trim()) {
      setErrorMessage("Company / Business Name is required.");
      return false;
    }
    if (!clientName.trim()) {
      setErrorMessage("Customer / Client Name is required.");
      return false;
    }
    if (!clientEmail.trim() || !clientEmail.includes("@")) {
      setErrorMessage("A valid Customer Email is required.");
      return false;
    }
    if (!clientAddress.trim()) {
      setErrorMessage("Customer Address is required.");
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
      const previewUrl = await previewQuotationPdf(data, selectedTemplate);
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
      if (initialData?._id) {
        await downloadQuotationPdf(initialData._id, `Quotation-${quotationId}.pdf`, selectedTemplate);
      } else {
        const url = await previewQuotationPdf(data, selectedTemplate);
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
    const fullPayload = {
      ...payload,
      templateId: selectedTemplate,
    };
    if (initialData?._id) {
      return await sendSavedQuotationEmail(initialData._id, fullPayload);
    } else {
      return await sendFormQuotationEmail(data, fullPayload);
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
            Fill the fields below to populate your quotation templates cleanly with full separation between your business and customer details.
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

      {/* Template Selection Control Bar */}
      <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
            PDF Template:
          </span>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="text-xs font-semibold px-3 py-1.5 bg-white border border-slate-300 rounded-lg shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800"
          >
            {availableTemplates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name} {tpl.isDefault ? "(Default)" : ""}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            {availableTemplates.find((t) => t.id === selectedTemplate)?.description}
          </span>
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
        {/* Section 1: Quotation Identification & Tax */}
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

        {/* Section 2: COMPANY DETAILS (Service Provider / Issuer) */}
        <div className="p-5 rounded-xl border border-indigo-100 bg-indigo-50/25 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100/70 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Company Details (Your Business / Provider)
                </h3>
                <p className="text-xs text-slate-500">
                  Your business credentials and banking details printed on the quotation header and footer.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-100/80 rounded-full">
              Service Provider
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
                Company Name *
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Surya Sangam Renewable Energy Pvt Ltd"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
                GSTIN Number
              </label>
              <input
                type="text"
                value={companyGstin}
                onChange={(e) => setCompanyGstin(e.target.value)}
                placeholder="e.g. 07AAAAA0000A1Z5"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
                Company Phone
              </label>
              <input
                type="text"
                value={companyPhone}
                onChange={(e) => setCompanyPhone(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
                Company Email
              </label>
              <input
                type="email"
                value={companyEmail}
                onChange={(e) => setCompanyEmail(e.target.value)}
                placeholder="e.g. info@suryasangam.com"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
                Company Website
              </label>
              <input
                type="text"
                value={companyWebsite}
                onChange={(e) => setCompanyWebsite(e.target.value)}
                placeholder="e.g. www.suryasangam.com"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
                Company Address
              </label>
              <input
                type="text"
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                placeholder="e.g. Sector 62, Electronic City, Noida, UP 201309"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Collapsible Bank Account Details */}
          <div className="pt-2 border-t border-indigo-100/60">
            <button
              type="button"
              onClick={() => setShowBankDetails(!showBankDetails)}
              className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-700 hover:text-indigo-900 transition"
            >
              <Landmark className="w-4 h-4 text-indigo-600" />
              <span>{showBankDetails ? "Hide Bank Account Details" : "Edit Bank Account Details (for technical templates & payment notes)"}</span>
              {showBankDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showBankDetails && (
              <div className="mt-3 p-4 bg-white rounded-lg border border-indigo-100 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. HDFC Bank Ltd"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Account Holder Name
                  </label>
                  <input
                    type="text"
                    value={bankAccountHolder}
                    onChange={(e) => setBankAccountHolder(e.target.value)}
                    placeholder="e.g. Surya Sangam Renewable Energy Pvt Ltd"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    placeholder="e.g. 50200012345678"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    IFSC Code
                  </label>
                  <input
                    type="text"
                    value={bankIfsc}
                    onChange={(e) => setBankIfsc(e.target.value)}
                    placeholder="e.g. HDFC0001234"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Branch Name
                  </label>
                  <input
                    type="text"
                    value={bankBranch}
                    onChange={(e) => setBankBranch(e.target.value)}
                    placeholder="e.g. Noida Sector 62 Branch"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Customer Details with integrated Row 2 & Row 3 entries */}
        <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/40 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Customer Details (Client / Recipient)
                </h3>
                <p className="text-xs text-slate-500">
                  Information regarding the prospective buyer or customer.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 rounded-full">
              Quotation Recipient
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
                Client / Company Name *
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Zenith Renewable Energy Solutions Ltd"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
                placeholder="e.g. procurement@zenithsolar.in"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
                Contact Person Name
              </label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="e.g. Mr. Amit Verma"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
                Client Phone Number
              </label>
              <input
                type="text"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="e.g. +91 91234 56789"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
                placeholder="e.g. Industrial Complex 4B, Sector 62, Noida, Uttar Pradesh 201309"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Row 2 & Row 3 Data Entries inside Customer Details (ONLY FOR TEMPLATE T4) */}
          {selectedTemplate === "t4" && (
            <div className="pt-4 mt-2 border-t border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Row 2 & Row 3 Data Entries
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Services, AMC, or installation charges for Template T4.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Row 2 Entry */}
                <div className="p-3.5 bg-white border border-slate-200 rounded-lg shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 inline-flex items-center justify-center text-[10px]">2</span>
                      Row 2: Product / Service & Specifications
                    </span>
                    <span className="text-[11px] text-slate-400">Services / AMC</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                      Description / Specification
                    </label>
                    <input
                      type="text"
                      value={row2Description}
                      onChange={(e) => setRow2Description(e.target.value)}
                      placeholder="Product / service and specifications"
                      className="w-full px-3 py-1.5 bg-slate-50/50 border border-slate-300 rounded-md text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                        Unit Price (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row2UnitPrice}
                        onChange={(e) => setRow2UnitPrice(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                        placeholder="0.00 (0 for Included)"
                        className="w-full px-3 py-1.5 bg-slate-50/50 border border-slate-300 rounded-md text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                        Quantity / Units
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={row2Quantity}
                        onChange={(e) => setRow2Quantity(e.target.value === "" ? "" : parseInt(e.target.value) || 1)}
                        placeholder="1"
                        className="w-full px-3 py-1.5 bg-slate-50/50 border border-slate-300 rounded-md text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Row 3 Entry */}
                <div className="p-3.5 bg-white border border-slate-200 rounded-lg shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 inline-flex items-center justify-center text-[10px]">3</span>
                      Row 3: Installation & Other Charges
                    </span>
                    <span className="text-[11px] text-slate-400">Installation / Freight</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                      Description / Charges
                    </label>
                    <input
                      type="text"
                      value={row3Description}
                      onChange={(e) => setRow3Description(e.target.value)}
                      placeholder="Installation / other charges, if applicable"
                      className="w-full px-3 py-1.5 bg-slate-50/50 border border-slate-300 rounded-md text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                        Unit Price (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row3UnitPrice}
                        onChange={(e) => setRow3UnitPrice(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                        placeholder="0.00 (0 for Included)"
                        className="w-full px-3 py-1.5 bg-slate-50/50 border border-slate-300 rounded-md text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                        Quantity / Units
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={row3Quantity}
                        onChange={(e) => setRow3Quantity(e.target.value === "" ? "" : parseInt(e.target.value) || 1)}
                        placeholder="1"
                        className="w-full px-3 py-1.5 bg-slate-50/50 border border-slate-300 rounded-md text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-[11px] text-slate-600">
                💡 <strong>Tip:</strong> Leave Unit Price as <strong>0</strong> to display as <em>&quot;Included&quot;</em> in quotation templates. Entering an amount will automatically calculate GST and update the Grand Total.
              </div>
            </div>
          )}
        </div>

        {/* Section 4: Dynamic Quotation Items Table */}
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
