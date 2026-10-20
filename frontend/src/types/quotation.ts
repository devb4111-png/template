export interface QuotationItem {
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal?: number;
}

export interface Quotation {
  _id: string;
  quotationId: string;
  quotationDate: string;
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  items: QuotationItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  terms: string[];
  createdAt: string;
  updatedAt: string;
}

export interface QuotationFormData {
  quotationId: string;
  quotationDate: string;
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  items: QuotationItem[];
  taxRate: number;
  terms: string[];
}
