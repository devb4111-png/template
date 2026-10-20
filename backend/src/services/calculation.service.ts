import { QuotationInput } from "../validation/quotation.schema";
import { IQuotationItem } from "../models/Quotation";

export interface CalculatedQuotationData {
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
}

export function roundToTwoDecimals(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function calculateQuotation(input: QuotationInput): CalculatedQuotationData {
  const items: IQuotationItem[] = input.items.map((item) => {
    const lineTotal = roundToTwoDecimals(item.quantity * item.unitPrice);
    return {
      itemName: item.itemName.trim(),
      quantity: item.quantity,
      unitPrice: roundToTwoDecimals(item.unitPrice),
      lineTotal,
    };
  });

  const subtotal = roundToTwoDecimals(
    items.reduce((acc, curr) => acc + curr.lineTotal, 0)
  );

  const taxRate = input.taxRate !== undefined ? input.taxRate : 18;
  const taxAmount = roundToTwoDecimals((subtotal * taxRate) / 100);
  const grandTotal = roundToTwoDecimals(subtotal + taxAmount);

  const defaultTerms = [
    "Quotation validity: 30 days.",
    "Installation and warranty: as specified in the final agreement.",
    "Payment schedule: as agreed with the customer.",
  ];

  const terms = input.terms && input.terms.length > 0 ? input.terms : defaultTerms;

  return {
    quotationId: input.quotationId.trim(),
    quotationDate: input.quotationDate.trim(),
    clientName: input.clientName.trim(),
    clientAddress: input.clientAddress.trim(),
    clientEmail: input.clientEmail.trim(),
    items,
    subtotal,
    taxRate,
    taxAmount,
    grandTotal,
    terms,
  };
}
