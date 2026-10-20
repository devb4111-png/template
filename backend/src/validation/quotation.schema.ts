import { z } from "zod";

export const QuotationItemInputSchema = z.object({
  itemName: z.string().min(1, "Item description is required"),
  quantity: z.number().positive("Quantity must be greater than 0"),
  unitPrice: z.number().nonnegative("Unit price cannot be negative"),
});

export const QuotationInputSchema = z.object({
  quotationId: z.string().min(1, "Quotation ID is required"),
  quotationDate: z.string().min(1, "Quotation date is required"),
  clientName: z.string().min(1, "Client name is required"),
  clientAddress: z.string().min(1, "Client address is required"),
  clientEmail: z.string().email("Valid client email is required"),
  items: z.array(QuotationItemInputSchema).min(1, "At least one item is required"),
  taxRate: z.number().nonnegative("Tax rate cannot be negative").default(18),
  terms: z.array(z.string()).optional(),
});

export type QuotationInput = z.infer<typeof QuotationInputSchema>;
