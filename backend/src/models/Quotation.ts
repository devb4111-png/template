import { Schema, model, Document } from "mongoose";

export interface IQuotationItem {
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface IQuotation extends Document {
  quotationId: string;
  quotationDate: string;
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  items: IQuotationItem[];
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
    quotationId: { type: String, required: true, unique: true, index: true },
    quotationDate: { type: String, required: true },
    clientName: { type: String, required: true },
    clientAddress: { type: String, required: true },
    clientEmail: { type: String, required: true },
    items: { type: [QuotationItemSchema], required: true },
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
