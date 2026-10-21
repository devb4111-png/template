export interface QuotationItem {
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal?: number;
}

export interface CompanyDetails {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  website?: string;
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  ifscCode?: string;
  branch?: string;
}

export interface Quotation {
  _id: string;
  templateId?: string;
  quotationId: string;
  quotationDate: string;
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  clientPhone?: string;
  contactPerson?: string;
  companyDetails?: CompanyDetails;
  items: QuotationItem[];
  row2Description?: string;
  row2UnitPrice?: number;
  row2Quantity?: number;
  row3Description?: string;
  row3UnitPrice?: number;
  row3Quantity?: number;
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
  clientPhone?: string;
  contactPerson?: string;
  companyDetails?: CompanyDetails;
  items: QuotationItem[];
  row2Description?: string;
  row2UnitPrice?: number;
  row2Quantity?: number;
  row3Description?: string;
  row3UnitPrice?: number;
  row3Quantity?: number;
  taxRate: number;
  terms: string[];
  templateId?: string;
}

export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  fileName: string;
  isDefault: boolean;
}
