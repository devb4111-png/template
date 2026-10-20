# Dynamic Quotation Template Filler

A production-grade, reliable quotation generation website built with **Next.js**, **Node.js**, **Express.js**, and **MongoDB**.

The application automatically takes user-entered quotation information, validates and recalculates all financial totals on the server, populates the official **Surya Sangam™** quotation template, and produces completed single-page and multi-page vector PDFs for download.

---

## 1. Project Structure

The project strictly separates frontend and backend code into distinct directories:

```
template/
├── backend/                       # Node.js + Express + TypeScript Backend
│   ├── src/
│   │   ├── assets/
│   │   │   └── logo.png           # Extracted lossless Surya Sangam™ RGBA logo
│   │   ├── database/
│   │   │   └── connection.ts      # MongoDB connection with embedded fallback
│   │   ├── models/
│   │   │   └── Quotation.ts       # Mongoose model for persistent quotations
│   │   ├── routes/
│   │   │   └── quotation.routes.ts# REST endpoints (CRUD & PDF streaming)
│   │   ├── services/
│   │   │   ├── calculation.service.ts # Precise server-side financial logic
│   │   │   └── pdf.service.ts     # Pixel-perfect HTML-to-PDF template engine
│   │   ├── validation/
│   │   │   └── quotation.schema.ts# Zod validation schema
│   │   └── server.ts              # Express application bootstrap
│   ├── .env                       # Environment configuration
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                      # Next.js 15 (App Router) + React 19 + TypeScript
│   ├── public/
│   │   └── logo.png               # Brand logo for UI navbar
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css        # Tailwind directives and styling
│   │   │   ├── layout.tsx         # Root layout
│   │   │   └── page.tsx           # Main application dashboard
│   │   ├── components/
│   │   │   ├── QuotationForm.tsx  # Dynamic form with live preview & row controls
│   │   │   └── SavedQuotationsList.tsx # MongoDB saved quotations manager
│   │   ├── services/
│   │   │   └── api.ts             # Typed API client
│   │   └── types/
│   │       └── quotation.ts       # TypeScript interfaces
│   ├── .env.local                 # Frontend environment configuration
│   ├── package.json
│   ├── tailwind.config.js
│   └── tsconfig.json
│
└── test_e2e.py                    # Automated end-to-end verification suite
```

---

## 2. Template Fidelity & Field Mapping

The document generation engine preserves the company's official Canva template format:
- **Dimensions**: A4 Portrait ($595.5 \times 850\,\text{pt}$).
- **Company Branding**: Includes the exact company logo (**SURYA SANGAM™** with tagline *"SIMPLE • SWIFT • SMART"*).
- **Divider Bars**: Header divider (`3.5px`), table top/bottom borders (`3px`), and section divider (`3px`).
- **Typography & Alignment**: Standardized sans-serif font, proper line wrapping, right-aligned monetary values, centered quantities.

### Field Mappings

| Form Field | Template Placeholder | Server Handling |
| :--- | :--- | :--- |
| Quotation ID | `QuotationId` | Required string, indexed & unique in MongoDB |
| Quotation Date | `QuotationDate` | Required date string (YYYY-MM-DD) |
| Client Name | `{clientName}` | Required string |
| Client Address | `{clientAddress}` | Multi-line text (newline preserved) |
| Client Email | `{clientEmail}` | Validated email format |
| Item Description | `{itemName}` | Dynamic row; wrapped cleanly without clipping |
| Quantity | `{quantity}` | Positive number |
| Unit Price | `{unitPrice}` | Positive number |
| Line Amount | `{lineTotal}` | Server calculated: $\text{Quantity} \times \text{Unit Price}$ |
| Subtotal | `{subtotal}` | Server calculated: $\sum \text{Line Totals}$ |
| GST / Tax Rate | `{taxAmount}` | Server calculated: $\text{Subtotal} \times \text{Tax Rate \%}$ |
| Grand Total | `{grandTotal}` | Server calculated: $\text{Subtotal} + \text{Tax Amount}$ |
| Terms and conditions | Predefined list | Standard 3 clauses, editable in form |

---

## 3. Dynamic Multi-Page Handling

- **Single-page quotations**: Retains clean single-page layout without unnecessary page breaks.
- **Multi-page quotations**: 
  - Automatically repeats table header (`<thead>`) on subsequent pages.
  - Avoids breaking individual rows (`tr { page-break-inside: avoid; }`).
  - Keeps totals and terms & conditions intact.

---

## 4. How to Run

### Backend
```bash
cd backend
npm install
npm run dev
```
Backend runs on `http://localhost:5000`.

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:3001` (or `3000`).

---

## 5. Automated Verification

Run the Python verification test:
```bash
python test_e2e.py
```
This tests:
1. Backend healthcheck.
2. Creation and server calculation of a single-page quotation.
3. PDF generation and verification of 1-page output.
4. Creation of a 24-item quotation and verification of multi-page pagination.
5. MongoDB quotation update and server-side recalculation.
6. Retrieval of saved quotations.
