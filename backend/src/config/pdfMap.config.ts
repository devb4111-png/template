/**
 * PDF Coordinate Mapping Configuration
 * 
 * STRICT TEMPLATE REGISTRY:
 * Only templates explicitly provided by the user are supported:
 * 1. "t2": Surya Sangam Official Canva Template (t2.pdf) - DEFAULT
 * 2. "t3": Solar Technical & Pricing Specification (t3.pdf)
 * 3. "t2-html": Surya Sangam HTML Engine (Canva Fidelity) - HTML renderer fallback
 * 
 * Coordinate System Convention:
 * - Origin (0,0) is at the BOTTOM-LEFT corner of each PDF page.
 * - Units are PostScript typographic points (1 pt = 1/72 inch).
 * - X increases from left to right (0 -> pageWidth).
 * - Y increases from bottom to top (0 -> pageHeight).
 */

export interface RectCover {
  x: number;
  y: number;
  width: number;
  height: number;
  color?: { r: number; g: number; b: number };
}

export interface FieldPlacement {
  pageIndex?: number;
  x: number;
  y: number;
  maxWidth?: number;
  maxLines?: number;
  fontSize?: number;
  fontName?: "Helvetica" | "Helvetica-Bold" | "Helvetica-Oblique";
  color?: { r: number; g: number; b: number };
  align?: "left" | "center" | "right";
  lineHeight?: number;
  coverPlaceholder?: RectCover;
  format?: (val: any) => string;
}

export interface TableColumnDef {
  id: "index" | "description" | "quantity" | "unitPrice" | "lineTotal" | "taxAmount";
  label?: string;
  x: number;
  width: number;
  align?: "left" | "center" | "right";
  fontSize?: number;
  fontName?: "Helvetica" | "Helvetica-Bold";
  format?: (val: any) => string;
}

export interface TablePageBoundary {
  pageIndex: number;
  startY: number;
  minY: number;
  rowHeight: number;
  coverExistingRows?: RectCover;
  showHeaders?: boolean;
}

export interface TableConfig {
  columns: TableColumnDef[];
  page1: TablePageBoundary;
  continuation: TablePageBoundary;
}

export interface TemplateDefinition {
  templateId: string;
  name: string;
  fileName: string;
  description: string;
  isInteractiveAcroForm: boolean;
  pageSize: {
    width: number;
    height: number;
  };
  fields: {
    quotationId: FieldPlacement;
    issueDate: FieldPlacement;
    clientName: FieldPlacement;
    clientAddress: FieldPlacement;
    clientEmail: FieldPlacement;
    subtotal: FieldPlacement;
    taxAmount: FieldPlacement;
    grandTotal: FieldPlacement;
    terms?: FieldPlacement;
  };
  table: TableConfig;
}

export const PDF_TEMPLATES_CONFIG: Record<string, TemplateDefinition> = {
  // 1. Surya Sangam Official Canva Template (t2.pdf) - USER DEFAULT TEMPLATE
  t2: {
    templateId: "t2",
    name: "Surya Sangam Official Canva Template (t2)",
    fileName: "t2.pdf",
    description: "Official Surya Sangam minimalist design with dark accent divider bars",
    isInteractiveAcroForm: false,
    pageSize: { width: 595.5, height: 842.25 },
    fields: {
      quotationId: {
        pageIndex: 0,
        x: 36.0,
        y: 641.89,
        maxWidth: 200,
        fontSize: 10.0,
        fontName: "Helvetica-Bold",
        color: { r: 0.08, g: 0.08, b: 0.08 },
        coverPlaceholder: { x: 34, y: 636, width: 190, height: 18 },
      },
      issueDate: {
        pageIndex: 0,
        x: 428.0,
        y: 641.89,
        maxWidth: 140,
        fontSize: 10.0,
        fontName: "Helvetica",
        color: { r: 0.08, g: 0.08, b: 0.08 },
        coverPlaceholder: { x: 425, y: 636, width: 140, height: 18 },
      },
      clientName: {
        pageIndex: 0,
        x: 35.0,
        y: 566.41,
        maxWidth: 380,
        fontSize: 10.5,
        fontName: "Helvetica-Bold",
        color: { r: 0.08, g: 0.08, b: 0.08 },
        coverPlaceholder: { x: 33, y: 520, width: 380, height: 56 },
      },
      clientAddress: {
        pageIndex: 0,
        x: 35.0,
        y: 550.05,
        maxWidth: 380,
        maxLines: 2,
        lineHeight: 11,
        fontSize: 8.5,
        fontName: "Helvetica",
        color: { r: 0.15, g: 0.15, b: 0.15 },
      },
      clientEmail: {
        pageIndex: 0,
        x: 35.0,
        y: 533.7,
        maxWidth: 380,
        fontSize: 8.5,
        fontName: "Helvetica",
        color: { r: 0.15, g: 0.15, b: 0.15 },
      },
      subtotal: {
        pageIndex: 0,
        x: 550.0,
        y: 358.02,
        maxWidth: 110,
        fontSize: 10.0,
        fontName: "Helvetica",
        align: "right",
        coverPlaceholder: { x: 440, y: 310, width: 125, height: 60 },
      },
      taxAmount: {
        pageIndex: 0,
        x: 550.0,
        y: 341.67,
        maxWidth: 110,
        fontSize: 10.0,
        fontName: "Helvetica",
        align: "right",
      },
      grandTotal: {
        pageIndex: 0,
        x: 550.0,
        y: 320.0,
        maxWidth: 120,
        fontSize: 11.0,
        fontName: "Helvetica-Bold",
        align: "right",
      },
      terms: {
        pageIndex: 0,
        x: 40.0,
        y: 211.19,
        maxWidth: 510,
        lineHeight: 18,
        fontSize: 8.5,
        fontName: "Helvetica",
        color: { r: 0.15, g: 0.15, b: 0.15 },
        coverPlaceholder: { x: 35, y: 150, width: 525, height: 80 },
      },
    },
    table: {
      columns: [
        {
          id: "description",
          label: "Description",
          x: 40.0,
          width: 195,
          align: "left",
          fontSize: 9.0,
          fontName: "Helvetica",
        },
        {
          id: "quantity",
          label: "Qty",
          x: 245.0,
          width: 40,
          align: "center",
          fontSize: 9.0,
          fontName: "Helvetica",
        },
        {
          id: "unitPrice",
          label: "Unit price",
          x: 310.0,
          width: 95,
          align: "right",
          fontSize: 9.0,
          fontName: "Helvetica",
        },
        {
          id: "lineTotal",
          label: "Amount",
          x: 435.0,
          width: 95,
          align: "right",
          fontSize: 9.0,
          fontName: "Helvetica-Bold",
        },
      ],
      page1: {
        pageIndex: 0,
        startY: 431.53,
        minY: 395.0,
        rowHeight: 20.0,
        coverExistingRows: { x: 35, y: 410, width: 528, height: 35 },
        showHeaders: true,
      },
      continuation: {
        pageIndex: 1,
        startY: 750.0,
        minY: 260.0,
        rowHeight: 20.0,
        showHeaders: false, // Headings only shown on the first page as requested
      },
    },
  },

  // 2. Technical Solar Quotation Specification Template (t3.pdf) - USER TEMPLATE (UPDATED A4)
  t3: {
    templateId: "t3",
    name: "Solar Technical & Pricing Specification (t3)",
    fileName: "t3.pdf",
    description: "Detailed solar quotation with separate company, customer, bank and pricing sections",
    isInteractiveAcroForm: false,
    pageSize: { width: 595.92, height: 842.88 },
    fields: {
      quotationId: {
        pageIndex: 0,
        x: 108.0,
        y: 792.63,
        maxWidth: 120,
        fontSize: 8.0,
        fontName: "Helvetica-Bold",
        color: { r: 0.1, g: 0.1, b: 0.1 },
        coverPlaceholder: { x: 104, y: 786, width: 120, height: 16 },
      },
      issueDate: {
        pageIndex: 0,
        x: 505.0,
        y: 792.63,
        maxWidth: 65,
        fontSize: 8.0,
        fontName: "Helvetica",
        color: { r: 0.1, g: 0.1, b: 0.1 },
        coverPlaceholder: { x: 500, y: 786, width: 65, height: 16 },
      },
      clientName: {
        pageIndex: 0,
        x: 390.0,
        y: 766.38,
        maxWidth: 170,
        fontSize: 7.5,
        fontName: "Helvetica-Bold",
        coverPlaceholder: { x: 385, y: 762, width: 175, height: 14 },
      },
      clientAddress: {
        pageIndex: 0,
        x: 345.0,
        y: 755.88,
        maxWidth: 215,
        fontSize: 7.0,
        fontName: "Helvetica",
        coverPlaceholder: { x: 340, y: 752, width: 220, height: 14 },
      },
      clientEmail: {
        pageIndex: 0,
        x: 335.0,
        y: 724.38,
        maxWidth: 225,
        fontSize: 7.0,
        fontName: "Helvetica",
        coverPlaceholder: { x: 330, y: 720, width: 230, height: 14 },
      },
      subtotal: {
        pageIndex: 0,
        x: 46.27,
        y: 540.63,
        maxWidth: 160,
        fontSize: 8.5,
        fontName: "Helvetica-Bold",
        align: "left",
        coverPlaceholder: { x: 45, y: 535, width: 165, height: 18 },
      },
      taxAmount: {
        pageIndex: 0,
        x: 217.01,
        y: 540.63,
        maxWidth: 100,
        fontSize: 8.5,
        fontName: "Helvetica-Bold",
        align: "left",
        coverPlaceholder: { x: 215, y: 535, width: 105, height: 18 },
      },
      grandTotal: {
        pageIndex: 0,
        x: 327.61,
        y: 540.63,
        maxWidth: 220,
        fontSize: 9.0,
        fontName: "Helvetica-Bold",
        align: "left",
        coverPlaceholder: { x: 325, y: 535, width: 228, height: 18 },
      },
      terms: {
        pageIndex: 0,
        x: 42.52,
        y: 484.38,
        maxWidth: 510,
        fontSize: 7.5,
        lineHeight: 10.5,
        fontName: "Helvetica",
        coverPlaceholder: { x: 42, y: 460, width: 515, height: 38 },
      },
    },
    table: {
      columns: [
        {
          id: "index",
          label: "S. No.",
          x: 72.0,
          width: 59,
          align: "center",
          fontSize: 7.5,
          fontName: "Helvetica",
        },
        {
          id: "description",
          label: "Type / Capacity of product",
          x: 105.0,
          width: 104,
          align: "left",
          fontSize: 7.5,
          fontName: "Helvetica",
        },
        {
          id: "unitPrice",
          label: "Unit Cost (INR)",
          x: 260.0,
          width: 61,
          align: "right",
          fontSize: 7.5,
          fontName: "Helvetica",
        },
        {
          id: "taxAmount",
          label: "Unit GST (INR)",
          x: 295.0,
          width: 55,
          align: "center",
          fontSize: 7.5,
          fontName: "Helvetica",
        },
        {
          id: "lineTotal",
          label: "Unit Rate incl. GST",
          x: 398.0,
          width: 82,
          align: "right",
          fontSize: 7.5,
          fontName: "Helvetica",
        },
        {
          id: "quantity",
          label: "No. of Units",
          x: 445.0,
          width: 70,
          align: "center",
          fontSize: 7.5,
          fontName: "Helvetica",
        },
      ],
      page1: {
        pageIndex: 0,
        startY: 622.38,
        minY: 585.0,
        rowHeight: 15.0,
        coverExistingRows: { x: 42, y: 585, width: 515, height: 50 },
        showHeaders: true,
      },
      continuation: {
        pageIndex: 1,
        startY: 750.0,
        minY: 380.0,
        rowHeight: 17.0,
        showHeaders: false, // Headings only shown on the first page as requested
      },
    },
  },

  // 3. Modern Product Specifications & Pricing Template (t4.pdf) - USER TEMPLATE (Letter 612 x 792)
  t4: {
    templateId: "t4",
    name: "Product Specifications & Pricing (t4)",
    fileName: "t4.pdf",
    description: "Modern product specifications quotation with automatic GST calculation and 6-column pricing grid",
    isInteractiveAcroForm: false,
    pageSize: { width: 612.0, height: 792.0 },
    fields: {
      quotationId: {
        pageIndex: 0,
        x: 148.0,
        y: 736.6,
        maxWidth: 120,
        fontSize: 7.6,
        fontName: "Helvetica-Bold",
        coverPlaceholder: { x: 145, y: 732, width: 90, height: 14 },
      },
      issueDate: {
        pageIndex: 0,
        x: 442.0,
        y: 736.6,
        maxWidth: 90,
        fontSize: 7.6,
        fontName: "Helvetica",
        coverPlaceholder: { x: 440, y: 732, width: 90, height: 14 },
      },
      clientName: {
        pageIndex: 0,
        x: 575.0,
        y: 627.9,
        maxWidth: 190,
        fontSize: 8.0,
        align: "right",
        fontName: "Helvetica-Bold",
        coverPlaceholder: { x: 380, y: 550, width: 200, height: 95 },
      },
      clientAddress: {
        pageIndex: 0,
        x: 575.0,
        y: 609.9,
        maxWidth: 190,
        fontSize: 7.5,
        align: "right",
        fontName: "Helvetica",
      },
      clientEmail: {
        pageIndex: 0,
        x: 575.0,
        y: 557.4,
        maxWidth: 190,
        fontSize: 7.5,
        align: "right",
        fontName: "Helvetica",
      },
      subtotal: {
        pageIndex: 0,
        x: 350.0,
        y: 296.4,
        maxWidth: 80,
        fontSize: 7.6,
        fontName: "Helvetica-Bold",
        align: "right",
      },
      taxAmount: {
        pageIndex: 0,
        x: 440.0,
        y: 296.4,
        maxWidth: 80,
        fontSize: 7.6,
        fontName: "Helvetica-Bold",
        align: "right",
      },
      grandTotal: {
        pageIndex: 0,
        x: 572.0,
        y: 296.4,
        maxWidth: 120,
        fontSize: 7.6,
        fontName: "Helvetica-Bold",
        align: "right",
      },
    },
    table: {
      columns: [
        { id: "index", label: "S. No.", x: 37.5, width: 57.0, align: "center", fontSize: 7.5 },
        { id: "description", label: "Type / Capacity of product", x: 94.5, width: 178.0, align: "left", fontSize: 7.5 },
        { id: "unitPrice", label: "Unit Cost (INR)", x: 272.5, width: 82.0, align: "right", fontSize: 7.5 },
        { id: "taxAmount", label: "Unit GST (INR)", x: 354.5, width: 51.0, align: "right", fontSize: 7.5 },
        { id: "quantity", label: "No. of Units", x: 405.5, width: 39.0, align: "center", fontSize: 7.5 },
        { id: "lineTotal", label: "Total Cost (incl. GST)", x: 444.5, width: 133.0, align: "right", fontSize: 7.5 },
      ],
      page1: {
        pageIndex: 0,
        startY: 460.0,
        minY: 395.0,
        rowHeight: 18.0,
        coverExistingRows: { x: 37.5, y: 395.0, width: 540.0, height: 68.0 },
        showHeaders: true,
      },
      continuation: {
        pageIndex: 1,
        startY: 735.0,
        minY: 350.0,
        rowHeight: 20.0,
        showHeaders: false,
      },
    },
  },
};

/**
 * Returns strictly the approved templates provided by the user
 */
export function getApprovedTemplatesList() {
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
      id: "t4",
      name: "Product Specifications & Pricing (t4)",
      description: "Product specifications and pricing template with automatic GST calculation",
      fileName: "t4.pdf",
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

/**
 * Validates if a templateId belongs to the approved list
 */
export function isValidTemplateId(templateId: string): boolean {
  if (!templateId) return false;
  return Boolean(PDF_TEMPLATES_CONFIG[templateId] || templateId === "t2-html");
}

/**
 * Resolves template configuration strictly from user-provided templates, defaulting to t2
 */
export function resolveTemplateConfig(templateId?: string): TemplateDefinition {
  if (!templateId || !PDF_TEMPLATES_CONFIG[templateId]) {
    return PDF_TEMPLATES_CONFIG["t2"];
  }
  return PDF_TEMPLATES_CONFIG[templateId];
}
