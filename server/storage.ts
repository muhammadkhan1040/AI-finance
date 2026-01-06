import { leads, rateSheets, type Lead, type InsertLead, type InsertLeadWithRates, type RateSheet, type InsertRateSheet } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  createLead(lead: InsertLead): Promise<Lead>;
  createLeadWithRates(lead: InsertLeadWithRates): Promise<Lead>;
  getLeads(): Promise<Lead[]>;
  createRateSheet(rateSheet: InsertRateSheet): Promise<RateSheet>;
  getRateSheets(): Promise<RateSheet[]>;
  getActiveRateSheets(): Promise<RateSheet[]>;
  deleteRateSheet(id: number): Promise<void>;
  toggleRateSheet(id: number, isActive: string): Promise<RateSheet>;
}

export class DatabaseStorage implements IStorage {
  async createLead(insertLead: InsertLead): Promise<Lead> {
    const [lead] = await db.insert(leads).values(insertLead).returning();
    return lead;
  }

  async createLeadWithRates(insertLead: InsertLeadWithRates): Promise<Lead> {
    const [lead] = await db.insert(leads).values(insertLead).returning();
    return lead;
  }

  async getLeads(): Promise<Lead[]> {
    return await db.select().from(leads);
  }

  async createRateSheet(insertRateSheet: InsertRateSheet): Promise<RateSheet> {
    const [rateSheet] = await db.insert(rateSheets).values(insertRateSheet).returning();
    return rateSheet;
  }

  async getRateSheets(): Promise<RateSheet[]> {
    return await db.select().from(rateSheets);
  }

  async getActiveRateSheets(): Promise<RateSheet[]> {
    return await db.select().from(rateSheets).where(eq(rateSheets.isActive, "yes"));
  }

  async deleteRateSheet(id: number): Promise<void> {
    await db.delete(rateSheets).where(eq(rateSheets.id, id));
  }

  async toggleRateSheet(id: number, isActive: string): Promise<RateSheet> {
    const [updated] = await db.update(rateSheets).set({ isActive }).where(eq(rateSheets.id, id)).returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
