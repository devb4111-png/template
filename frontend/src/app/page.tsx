"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import QuotationForm from "../components/QuotationForm";
import SavedQuotationsList from "../components/SavedQuotationsList";
import { Quotation } from "../types/quotation";
import { fetchQuotations } from "../services/api";
import { RefreshCw, CheckCircle2 } from "lucide-react";

export default function Home() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQuotations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchQuotations();
      setQuotations(data);
    } catch (err: any) {
      console.error("Error loading quotations:", err);
      setError(err.message || "Failed to load quotations");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuotations();
  }, [loadQuotations]);

  const handleSelectQuotation = (quotation: Quotation) => {
    setSelectedQuotation(quotation);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSaved = () => {
    loadQuotations();
  };

  const handleReset = () => {
    setSelectedQuotation(null);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 pb-16">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-36 relative flex items-center">
              {/* Official extracted company logo */}
              <img
                src="/logo.png"
                alt="SURYA SANGAM"
                className="h-9 w-auto object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                }}
              />
            </div>
            <div className="hidden sm:block border-l border-slate-200 pl-4">
              <h1 className="text-sm font-bold text-slate-800 tracking-tight">
                Quotation Template Filler
              </h1>
              <p className="text-[11px] text-slate-500">
                Official Surya Sangam Canva Template Format
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              MongoDB Active
            </div>
            <button
              onClick={loadQuotations}
              disabled={isLoading}
              title="Refresh saved quotations"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center justify-between">
            <div>
              <strong>Backend Notice:</strong> {error}. Ensure backend is running at http://localhost:5000.
            </div>
            <button
              onClick={loadQuotations}
              className="px-3 py-1 bg-amber-200 hover:bg-amber-300 rounded text-xs font-semibold text-amber-900"
            >
              Retry
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Form (8 cols on large screens) */}
          <div className="lg:col-span-8">
            <QuotationForm
              initialData={selectedQuotation}
              onSaved={handleSaved}
              onReset={handleReset}
            />
          </div>

          {/* Saved Quotations Sidebar (4 cols on large screens) */}
          <div className="lg:col-span-4 sticky top-20">
            <SavedQuotationsList
              quotations={quotations}
              onSelectQuotation={handleSelectQuotation}
              onRefresh={loadQuotations}
              currentSelectedId={selectedQuotation?._id}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
