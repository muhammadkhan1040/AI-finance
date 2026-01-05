import { pgTable, text, serial, integer, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
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
  propertyValue: integer("property_value"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLeadSchema = createInsertSchema(leads).omit({ 
  id: true, 
  createdAt: true 
}).extend({
  email: z.string().email(),
  phone: z.string().min(10),
  loanAmount: z.number().min(0),
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;

export const ratesSchema = z.object({
  rate: z.number(),
  apr: z.number(),
  lender: z.string(),
  monthlyPayment: z.number(),
});

export type Rate = z.infer<typeof ratesSchema>;
