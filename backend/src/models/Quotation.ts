import { Schema, model, Document } from "mongoose";

export interface IQuotationItem {
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ICompanyDetails {
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

export interface IQuotation extends Document {
  templateId?: string;
  quotationId: string;
  quotationDate: string;
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  clientPhone?: string;
  contactPerson?: string;
  companyDetails?: ICompanyDetails;
  items: IQuotationItem[];
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
  createdAt: Date;
  updatedAt: Date;
}

const QuotationItemSchema = new Schema<IQuotationItem>(
  {
    itemName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0.01 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const QuotationSchema = new Schema<IQuotation>(
  {
    templateId: { type: String, default: "t2" },
    quotationId: { type: String, required: true, unique: true, index: true },
    quotationDate: { type: String, required: true },
    clientName: { type: String, required: true },
    clientAddress: { type: String, required: true },
    clientEmail: { type: String, required: true },
    clientPhone: { type: String },
    contactPerson: { type: String },
    companyDetails: {
      type: {
        name: String,
        address: String,
        phone: String,
        email: String,
        gstin: String,
        website: String,
        bankName: String,
        accountHolder: String,
        accountNumber: String,
        ifscCode: String,
        branch: String,
      },
      default: {
        name: "Surya Sangam Renewable Energy Pvt Ltd",
        address: "Sector 62, Electronic City, Noida, UP 201309",
        phone: "+91 98765 43210",
        email: "info@suryasangam.com",
        gstin: "07AAAAA0000A1Z5",
        website: "www.suryasangam.com",
        bankName: "HDFC Bank Ltd",
        accountHolder: "Surya Sangam Renewable Energy Pvt Ltd",
        accountNumber: "50200012345678",
        ifscCode: "HDFC0001234",
        branch: "Noida Sector 62 Branch",
      },
    },
    items: { type: [QuotationItemSchema], required: true },
    row2Description: { type: String },
    row2UnitPrice: { type: Number },
    row2Quantity: { type: Number },
    row3Description: { type: String },
    row3UnitPrice: { type: Number },
    row3Quantity: { type: Number },
    subtotal: { type: Number, required: true },
    taxRate: { type: Number, required: true, default: 18 },
    taxAmount: { type: Number, required: true },
    grandTotal: { type: Number, required: true },
    terms: {
      type: [String],
      default: [
        "Quotation validity: 30 days.",
        "Installation and warranty: as specified in the final agreement.",
        "Payment schedule: as agreed with the customer.",
      ],
    },
  },
  {
    timestamps: true,
  }
);

export const Quotation = model<IQuotation>("Quotation", QuotationSchema);
