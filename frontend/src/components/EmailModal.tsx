"use client";

import React, { useState, useEffect } from "react";
import { Mail, X, Send, CheckCircle2, AlertCircle, ExternalLink, Info } from "lucide-react";
import { checkSmtpStatus } from "../services/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  quotationId: string;
  defaultRecipient: string;
  defaultSubject: string;
  onSend: (payload: { recipientEmail: string; subject: string; message: string }) => Promise<{
    success: boolean;
    message: string;
    previewUrl?: string | false;
  }>;
}

export default function EmailModal({
  isOpen,
  onClose,
  quotationId,
  defaultRecipient,
  defaultSubject,
  onSend,
}: Props) {
  const [recipient, setRecipient] = useState(defaultRecipient);
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState(
    `Dear Customer,\n\nPlease find attached the official quotation ${quotationId} from Surya Sangam.\n\nThank you for choosing us!`
  );
  const [isSending, setIsSending] = useState(false);
  const [smtpInfo, setSmtpInfo] = useState<{
    isConfigured: boolean;
    host: string | null;
    from: string | null;
  } | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    previewUrl?: string | false;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRecipient(defaultRecipient);
      setSubject(defaultSubject);
      setMessage(
        `Dear Customer,\n\nPlease find attached the official quotation ${quotationId} from Surya Sangam.\n\nThank you for choosing us!`
      );
      setResult(null);
      setError(null);
      checkSmtpStatus().then(setSmtpInfo);
    }
  }, [defaultRecipient, defaultSubject, quotationId, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient.trim() || !recipient.includes("@")) {
      setError("Please enter a valid recipient email address.");
      return;
    }

    setIsSending(true);
    setError(null);
    setResult(null);

    try {
      const res = await onSend({
        recipientEmail: recipient.trim(),
        subject: subject.trim(),
        message: message.trim(),
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Send Quotation by Email</h3>
              <p className="text-xs text-slate-500 font-mono">Quotation ID: {quotationId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {smtpInfo && !smtpInfo.isConfigured && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                SMTP Not Configured (Development Sandbox Active)
              </div>
              <p className="text-[11px] text-amber-800/90 leading-relaxed">
                Emails are currently generated in test sandbox (Ethereal) and will not reach real customer inboxes. To send directly to your customer's Gmail/Outlook, configure SMTP credentials in <strong>backend/.env</strong>.
              </p>
            </div>
          )}

          {smtpInfo && smtpInfo.isConfigured && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Live Delivery Active via <strong>{smtpInfo.host}</strong> ({smtpInfo.from})</span>
            </div>
          )}

          {result && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                {result.message}
              </div>
              {result.previewUrl && (
                <div className="pt-3 border-t border-emerald-200/80 space-y-2">
                  <p className="text-xs text-emerald-900 font-medium">
                    Email dispatched to the development sandbox. You can open the full message with the attached PDF in your browser:
                  </p>
                  <a
                    href={result.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Sent Email in Sandbox Preview
                  </a>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
              Recipient Email *
            </label>
            <input
              type="email"
              required
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="e.g. client@example.com"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
              Subject Line *
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
              Message Note (Optional)
            </label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
            <span className="font-semibold text-slate-700">Attachment:</span>
            <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Quotation-{quotationId}.pdf
            </span>
            <span className="text-slate-400 text-[11px]">(Auto-generated official PDF)</span>
          </div>

          {/* Footer actions */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              {result ? "Close" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={isSending}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition shadow-sm disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {isSending ? "Sending Email..." : "Send Email"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
