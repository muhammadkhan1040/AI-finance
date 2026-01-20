import { leads, rateSheets, type Lead, type InsertLead, type InsertLeadWithRates, type RateSheet, type InsertRateSheet } from "@shared/schema";
import { db, isUsingSqlite } from "./db";
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

// In-memory storage for local testing (when DATABASE_URL is not set)
class InMemoryStorage implements IStorage {
  private leads: Lead[] = [];
  private rateSheets: RateSheet[] = [];
  private leadIdCounter = 1;
  private rateSheetIdCounter = 1;

  async createLead(insertLead: InsertLead): Promise<Lead> {
    const lead: Lead = {
      id: this.leadIdCounter++,
      firstName: insertLead.firstName,
      lastName: insertLead.lastName,
      email: insertLead.email,
      phone: insertLead.phone,
      loanAmount: insertLead.loanAmount,
      loanPurpose: insertLead.loanPurpose,
      refinanceType: insertLead.refinanceType || null,
      creditScore: insertLead.creditScore,
      zipCode: insertLead.zipCode,
      propertyValue: insertLead.propertyValue,
      loanTerm: insertLead.loanTerm || "30yr",
      propertyType: insertLead.propertyType || "single_family",
      loanType: insertLead.loanType || "conventional",
      annualIncome: insertLead.annualIncome || 0,
      isFirstTimeBuyer: insertLead.isFirstTimeBuyer || "no",
      quotedRates: null,
      createdAt: new Date(),
    };
    this.leads.push(lead);
    console.log(`[IN-MEMORY] Created lead #${lead.id}`);
    return lead;
  }

  async createLeadWithRates(insertLead: InsertLeadWithRates): Promise<Lead> {
    const lead: Lead = {
      id: this.leadIdCounter++,
      firstName: insertLead.firstName,
      lastName: insertLead.lastName,
      email: insertLead.email,
      phone: insertLead.phone,
      loanAmount: insertLead.loanAmount,
      loanPurpose: insertLead.loanPurpose,
      refinanceType: insertLead.refinanceType || null,
      creditScore: insertLead.creditScore,
      zipCode: insertLead.zipCode,
      propertyValue: insertLead.propertyValue,
      loanTerm: insertLead.loanTerm || "30yr",
      propertyType: insertLead.propertyType || "single_family",
      loanType: insertLead.loanType || "conventional",
      annualIncome: insertLead.annualIncome || 0,
      isFirstTimeBuyer: insertLead.isFirstTimeBuyer || "no",
      quotedRates: insertLead.quotedRates || null,
      createdAt: new Date(),
    };
    this.leads.push(lead);
    console.log(`[IN-MEMORY] Created lead with rates #${lead.id}`);
    return lead;
  }

  async getLeads(): Promise<Lead[]> {
    return this.leads;
  }

  async createRateSheet(insertRateSheet: InsertRateSheet): Promise<RateSheet> {
    const rateSheet: RateSheet = {
      id: this.rateSheetIdCounter++,
      lenderName: insertRateSheet.lenderName,
      fileName: insertRateSheet.fileName,
      fileData: insertRateSheet.fileData,
      isActive: insertRateSheet.isActive || "yes",
      uploadedAt: new Date(),
    };
    this.rateSheets.push(rateSheet);
    console.log(`[IN-MEMORY] Created rate sheet #${rateSheet.id} for ${rateSheet.lenderName}`);
    return rateSheet;
  }

  async getRateSheets(): Promise<RateSheet[]> {
    return this.rateSheets;
  }

  async getActiveRateSheets(): Promise<RateSheet[]> {
    return this.rateSheets.filter(rs => rs.isActive === "yes");
  }

  async deleteRateSheet(id: number): Promise<void> {
    const idx = this.rateSheets.findIndex(rs => rs.id === id);
    if (idx !== -1) {
      this.rateSheets.splice(idx, 1);
      console.log(`[IN-MEMORY] Deleted rate sheet #${id}`);
    }
  }

  async toggleRateSheet(id: number, isActive: string): Promise<RateSheet> {
    const rateSheet = this.rateSheets.find(rs => rs.id === id);
    if (rateSheet) {
      rateSheet.isActive = isActive;
      console.log(`[IN-MEMORY] Toggled rate sheet #${id} to ${isActive}`);
    }
    return rateSheet!;
  }
}

// Database storage for production (PostgreSQL)
export class DatabaseStorage implements IStorage {
  async createLead(insertLead: InsertLead): Promise<Lead> {
    const [lead] = await db!.insert(leads).values(insertLead).returning();
    return lead;
  }

  async createLeadWithRates(insertLead: InsertLeadWithRates): Promise<Lead> {
    const [lead] = await db!.insert(leads).values(insertLead).returning();
    return lead;
  }

  async getLeads(): Promise<Lead[]> {
    return await db!.select().from(leads);
  }

  async createRateSheet(insertRateSheet: InsertRateSheet): Promise<RateSheet> {
    const [rateSheet] = await db!.insert(rateSheets).values(insertRateSheet).returning();
    return rateSheet;
  }

  async getRateSheets(): Promise<RateSheet[]> {
    return await db!.select().from(rateSheets);
  }

  async getActiveRateSheets(): Promise<RateSheet[]> {
    return await db!.select().from(rateSheets).where(eq(rateSheets.isActive, "yes"));
  }

  async deleteRateSheet(id: number): Promise<void> {
    await db!.delete(rateSheets).where(eq(rateSheets.id, id));
  }

  async toggleRateSheet(id: number, isActive: string): Promise<RateSheet> {
    const [updated] = await db!.update(rateSheets).set({ isActive }).where(eq(rateSheets.id, id)).returning();
    return updated;
  }
}

// Export the appropriate storage based on environment
export const storage: IStorage = isUsingSqlite
  ? new InMemoryStorage()
  : new DatabaseStorage();

console.log(`[STORAGE] Using ${isUsingSqlite ? 'IN-MEMORY' : 'PostgreSQL'} storage`);
