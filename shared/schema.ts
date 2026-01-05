import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  loanAmount: integer("loan_amount").notNull(),
  loanPurpose: text("loan_purpose").notNull(), // 'purchase' | 'refinance'
  creditScore: text("credit_score").notNull(), // 'excellent' | 'good' | 'fair' | 'poor'
  zipCode: text("zip_code").notNull(),
  propertyValue: integer("property_value").notNull(),
  loanTerm: text("loan_term").notNull().default("30yr"),
  propertyType: text("property_type").notNull().default("single_family"),
  loanType: text("loan_type").notNull().default("conventional"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLeadSchema = createInsertSchema(leads).omit({ 
  id: true, 
  createdAt: true 
}).extend({
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Please enter a valid 10-digit phone number"),
  loanAmount: z.number().min(1, "Loan amount is required"),
  propertyValue: z.number().min(1, "Property value is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  zipCode: z.string().min(5, "Valid zip code is required"),
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;

export const ratesSchema = z.object({
  rate: z.number(),
  apr: z.number(),
  lender: z.string(),
  monthlyPayment: z.number(),
  processingFee: z.number(),
  underwritingFee: z.number(),
});

export type Rate = z.infer<typeof ratesSchema>;
