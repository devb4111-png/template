import { QuotationInput } from "../validation/quotation.schema";
import { IQuotationItem } from "../models/Quotation";

export interface CalculatedQuotationData {
  templateId?: string;
  quotationId: string;
  quotationDate: string;
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  clientPhone?: string;
  contactPerson?: string;
  companyDetails: {
    name: string;
    address: string;
    phone: string;
    email: string;
    gstin?: string;
    website?: string;
    bankName?: string;
    accountHolder?: string;
    accountNumber?: string;
    ifscCode?: string;
    branch?: string;
  };
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
  totalUnits: number;
  totalPayableInWords: string;
  terms: string[];
}

export function numberToIndianWords(num: number): string {
  if (isNaN(num) || num === 0) return "Zero Rupees Only";
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function inWords(n: number): string {
    if (n < 20) return a[n];
    const digit = n % 10;
    return b[Math.floor(n / 10)] + (digit ? " " + a[digit] : "");
  }

  const intPart = Math.floor(Math.abs(num));
  const paise = Math.round((Math.abs(num) - intPart) * 100);

  let str = "";
  const crore = Math.floor(intPart / 10000000);
  const lakh = Math.floor((intPart % 10000000) / 100000);
  const thousand = Math.floor((intPart % 100000) / 1000);
  const hundred = Math.floor((intPart % 1000) / 100);
  const rest = intPart % 100;

  if (crore > 0) str += inWords(crore) + " Crore ";
  if (lakh > 0) str += inWords(lakh) + " Lakh ";
  if (thousand > 0) str += inWords(thousand) + " Thousand ";
  if (hundred > 0) str += inWords(hundred) + " Hundred ";
  if (rest > 0) str += inWords(rest) + " ";

  str = str.trim() + " Rupees";
  if (paise > 0) {
    str += " and " + inWords(paise) + " Paise";
  }
  return str + " Only";
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

  let subtotal = roundToTwoDecimals(
    items.reduce((acc, curr) => acc + curr.lineTotal, 0)
  );

  const row2UnitPrice = input.row2UnitPrice !== undefined ? roundToTwoDecimals(input.row2UnitPrice) : undefined;
  const row2Quantity = input.row2Quantity !== undefined ? input.row2Quantity : (row2UnitPrice !== undefined && row2UnitPrice > 0 ? 1 : undefined);
  if (input.templateId === "t4" && row2UnitPrice !== undefined && row2UnitPrice > 0) {
    subtotal = roundToTwoDecimals(subtotal + (row2Quantity || 1) * row2UnitPrice);
  }

  const row3UnitPrice = input.row3UnitPrice !== undefined ? roundToTwoDecimals(input.row3UnitPrice) : undefined;
  const row3Quantity = input.row3Quantity !== undefined ? input.row3Quantity : (row3UnitPrice !== undefined && row3UnitPrice > 0 ? 1 : undefined);
  if (input.templateId === "t4" && row3UnitPrice !== undefined && row3UnitPrice > 0) {
    subtotal = roundToTwoDecimals(subtotal + (row3Quantity || 1) * row3UnitPrice);
  }

  const taxRate = input.taxRate !== undefined ? input.taxRate : 18;
  const taxAmount = roundToTwoDecimals((subtotal * taxRate) / 100);
  const grandTotal = roundToTwoDecimals(subtotal + taxAmount);

  const defaultTerms = [
    "Quotation validity: 30 days.",
    "Installation and warranty: as specified in the final agreement.",
    "Payment schedule: as agreed with the customer.",
  ];

  const terms = input.terms && input.terms.length > 0 ? input.terms : defaultTerms;

  let totalUnits = items.reduce((acc, curr) => acc + curr.quantity, 0);
  if (input.templateId === "t4") {
    if (row2UnitPrice !== undefined && row2UnitPrice > 0) {
      totalUnits += (row2Quantity || 1);
    }
    if (row3UnitPrice !== undefined && row3UnitPrice > 0) {
      totalUnits += (row3Quantity || 1);
    }
  }

  const defaultCompany = {
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
  };

  const inputCompany = input.companyDetails || {};
  const companyDetails = {
    name: inputCompany.name?.trim() || defaultCompany.name,
    address: inputCompany.address?.trim() || defaultCompany.address,
    phone: inputCompany.phone?.trim() || defaultCompany.phone,
    email: inputCompany.email?.trim() || defaultCompany.email,
    gstin: inputCompany.gstin?.trim() || defaultCompany.gstin,
    website: inputCompany.website?.trim() || defaultCompany.website,
    bankName: inputCompany.bankName?.trim() || defaultCompany.bankName,
    accountHolder: inputCompany.accountHolder?.trim() || defaultCompany.accountHolder,
    accountNumber: inputCompany.accountNumber?.trim() || defaultCompany.accountNumber,
    ifscCode: inputCompany.ifscCode?.trim() || defaultCompany.ifscCode,
    branch: inputCompany.branch?.trim() || defaultCompany.branch,
  };

  return {
    templateId: input.templateId || "t2",
    quotationId: input.quotationId.trim(),
    quotationDate: input.quotationDate.trim(),
    clientName: input.clientName.trim(),
    clientAddress: input.clientAddress.trim(),
    clientEmail: input.clientEmail.trim(),
    clientPhone: input.clientPhone?.trim(),
    contactPerson: input.contactPerson?.trim(),
    companyDetails,
    items,
    row2Description: input.row2Description?.trim(),
    row2UnitPrice,
    row2Quantity,
    row3Description: input.row3Description?.trim(),
    row3UnitPrice,
    row3Quantity,
    subtotal,
    taxRate,
    taxAmount,
    grandTotal,
    totalUnits,
    totalPayableInWords: numberToIndianWords(grandTotal),
    terms,
  };
}
