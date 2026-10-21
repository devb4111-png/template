import { z } from "zod";

export const QuotationItemInputSchema = z.object({
  itemName: z.string().min(1, "Item description is required"),
  quantity: z.number().positive("Quantity must be greater than 0"),
  unitPrice: z.number().nonnegative("Unit price cannot be negative"),
});

export const CompanyDetailsSchema = z.object({
  name: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  gstin: z.string().optional(),
  website: z.string().optional(),
  bankName: z.string().optional(),
  accountHolder: z.string().optional(),
  accountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  branch: z.string().optional(),
}).optional();

export const QuotationInputSchema = z.object({
  quotationId: z.string().min(1, "Quotation ID is required"),
  quotationDate: z.string().min(1, "Quotation date is required"),
  clientName: z.string().min(1, "Client name is required"),
  clientAddress: z.string().min(1, "Client address is required"),
  clientEmail: z.string().email("Valid client email is required"),
  clientPhone: z.string().optional(),
  contactPerson: z.string().optional(),
  companyDetails: CompanyDetailsSchema,
  items: z.array(QuotationItemInputSchema).min(1, "At least one item is required"),
  row2Description: z.string().optional(),
  row2UnitPrice: z.number().nonnegative().optional(),
  row2Quantity: z.number().positive().optional(),
  row3Description: z.string().optional(),
  row3UnitPrice: z.number().nonnegative().optional(),
  row3Quantity: z.number().positive().optional(),
  taxRate: z.number().nonnegative("Tax rate cannot be negative").default(18),
  terms: z.array(z.string()).optional(),
  templateId: z.string().optional(),
});

export type QuotationInput = z.infer<typeof QuotationInputSchema>;
