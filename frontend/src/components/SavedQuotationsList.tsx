"use client";

import React, { useState } from "react";
import { Quotation } from "../types/quotation";
import { Download, Edit3, Trash2, Search, FileText, Calendar, IndianRupee, Mail } from "lucide-react";
import { deleteQuotation, downloadQuotationPdf, sendSavedQuotationEmail } from "../services/api";
import EmailModal from "./EmailModal";

interface Props {
  quotations: Quotation[];
  onSelectQuotation: (quotation: Quotation) => void;
  onRefresh: () => void;
  currentSelectedId?: string;
}

export default function SavedQuotationsList({
  quotations,
  onSelectQuotation,
  onRefresh,
  currentSelectedId,
}: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [emailQuotation, setEmailQuotation] = useState<Quotation | null>(null);

  const filtered = quotations.filter((q) => {
    const term = searchTerm.toLowerCase();
    return (
      q.quotationId.toLowerCase().includes(term) ||
      q.clientName.toLowerCase().includes(term) ||
      q.clientEmail.toLowerCase().includes(term)
    );
  });

  const handleDelete = async (id: string, qId: string) => {
    if (!window.confirm(`Are you sure you want to delete quotation "${qId}"?`)) {
      return;
    }

    setDeletingId(id);
    try {
      await deleteQuotation(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || "Failed to delete quotation");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (id: string, qId: string, templateId?: string) => {
    setDownloadingId(id);
    try {
      await downloadQuotationPdf(id, `Quotation-${qId}.pdf`, templateId);
    } catch (err: any) {
      alert(err.message || "Failed to download PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
      {/* Header & Search */}
      <div className="p-5 border-b border-slate-200 bg-slate-50/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-800 text-base">Saved Quotations</h3>
          </div>
          <span className="text-xs px-2.5 py-1 bg-emerald-100 text-emerald-800 font-semibold rounded-full">
            {quotations.length} saved
          </span>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by ID, client or email..."
            className="w-full pl-9 pr-3.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-[700px]">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-1" />
            <p className="text-sm font-medium text-slate-500">No quotations found</p>
            <p className="text-xs text-slate-400 mt-1">
              {searchTerm ? "Try a different search keyword" : "Save a quotation using the form"}
            </p>
          </div>
        ) : (
          filtered.map((item) => {
            const isSelected = currentSelectedId === item._id || currentSelectedId === item.quotationId;
            return (
              <div
                key={item._id}
                className={`p-4 transition hover:bg-slate-50 ${
                  isSelected ? "bg-emerald-50/60 border-l-4 border-l-emerald-600" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-slate-800 tracking-wide font-mono bg-slate-100 px-2 py-0.5 rounded">
                      {item.quotationId}
                    </span>
                    {item.templateId && (
                      <span className="ml-1.5 text-[10px] uppercase font-bold text-emerald-800 bg-emerald-100/80 px-1.5 py-0.5 rounded">
                        {item.templateId}
                      </span>
                    )}
                    <h4 className="text-sm font-semibold text-slate-800 mt-1 line-clamp-1">
                      {item.clientName}
                    </h4>
                    <p className="text-xs text-slate-500 line-clamp-1">{item.clientEmail}</p>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-bold text-emerald-700">
                      ₹{formatCurrency(item.grandTotal)}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {item.items?.length || 0} item{item.items?.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{item.quotationDate}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onSelectQuotation(item)}
                      title="Reopen and edit"
                      className="inline-flex items-center gap-1 px-2 py-1 text-slate-600 hover:text-emerald-700 hover:bg-white border border-transparent hover:border-slate-200 rounded font-medium transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(item._id, item.quotationId, item.templateId)}
                      disabled={downloadingId === item._id}
                      title="Download PDF"
                      className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 rounded transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmailQuotation(item)}
                      title="Send via Email"
                      className="p-1 text-slate-600 hover:text-emerald-700 hover:bg-white border border-transparent hover:border-slate-200 rounded transition"
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item._id, item.quotationId)}
                      disabled={deletingId === item._id}
                      title="Delete quotation"
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {emailQuotation && (
        <EmailModal
          isOpen={!!emailQuotation}
          onClose={() => setEmailQuotation(null)}
          quotationId={emailQuotation.quotationId}
          defaultRecipient={emailQuotation.clientEmail}
          defaultSubject={`Quotation ${emailQuotation.quotationId} from Surya Sangam`}
          onSend={(payload) => sendSavedQuotationEmail(emailQuotation._id, payload)}
        />
      )}
    </div>
  );
}
