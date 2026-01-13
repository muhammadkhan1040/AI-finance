import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { type Rate } from "@shared/schema";
import { syncLeadsToSheet, appendLeadToSheet } from "./googleSheets";
import { calculateRates, generateMockQuotes, type LoanParameters, type LenderQuote } from "./pricingEngine";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Admin credentials from environment (can be changed in Replit Secrets panel for recovery)
  const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    console.warn("WARNING: ADMIN_USERNAME and ADMIN_PASSWORD secrets are not set. Admin login will be disabled.");
  }

  // Middleware to check admin authentication
  function requireAdmin(req: Request, res: Response, next: NextFunction) {
    const session = (req as any).session;
    if (session?.isAdmin) {
      next();
    } else {
      res.status(401).json({ message: "Unauthorized" });
    }
  }

  // Admin login endpoint
  app.post("/api/admin/login", (req, res) => {
    if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
      return res.status(503).json({ message: "Admin login is not configured. Please set ADMIN_USERNAME and ADMIN_PASSWORD in Replit Secrets." });
    }
    
    const { username, password } = req.body;
    const session = (req as any).session;
    
    if (username.toLowerCase() === ADMIN_USERNAME.toLowerCase() && password === ADMIN_PASSWORD) {
      session.isAdmin = true;
      res.json({ success: true });
    } else {
      res.status(401).json({ message: "Invalid credentials" });
    }
  });

  // Admin logout endpoint
  app.post("/api/admin/logout", (req, res) => {
    const session = (req as any).session;
    session.destroy((err: Error) => {
      if (err) {
        res.status(500).json({ message: "Logout failed" });
      } else {
        res.json({ success: true });
      }
    });
  });

  // Check admin session status
  app.get("/api/admin/session", (req, res) => {
    const session = (req as any).session;
    res.json({ isAdmin: !!session?.isAdmin });
  });

  // Helper to generate mock rates based on credit score
  function getMockRates(score: string, amount: number, term: string | undefined): Rate[] {
    let baseRate = 6.5; 
    
    // Adjust base rate based on term
    if (term === '15yr') baseRate = 5.880; // From APOR 15/20 Yr Fixed
    else if (term === '10yr') baseRate = 5.750; // From APOR 10 Yr Fixed
    else if (term === '20yr') baseRate = 5.880; // From APOR 15/20 Yr Fixed
    else baseRate = 6.250; // Default 30 Yr Fixed APOR

    // Underwriting fees from PRMG sheet (Page 1)
    const underwritingFee = (term === 'dscr' || score.includes('Non-QM')) ? 1545 : 1245;
    const processingFee = 895;

    // Map new ranges to rate adjustments (Estimated from Agency Fannie Mae Pg.3)
    if (score === '780+') baseRate -= 0.5;
    else if (score === '760-780') baseRate -= 0.375;
    else if (score === '740-759') baseRate -= 0.25;
    else if (score === '720-739') baseRate -= 0.125;
    else if (score === '700-719') baseRate += 0;
    else if (score === '680-699') baseRate += 0.125;
    else if (score === '640-679') baseRate += 0.25;
    else if (score === '620-639') baseRate += 0.375;
    else if (score === '601-619') baseRate += 0.5;
    else if (score === '580-600') baseRate += 0.75;

    // Adjust for DSCR (PRMG adds premium for Non-QM/DSCR - Pg 16/17)
    if (term === 'dscr') baseRate += 0.75;

    // finalRate is the base interest rate
    const finalRate = Number(baseRate.toFixed(3));

    // APR Calculation helper
    const calculateApr = (r: number, f: number) => Number((r + (f / amount / 30) * 100 + 0.15).toFixed(3));

    return [
      {
        lender: "PRMG (Standard)",
        rate: finalRate,
        apr: calculateApr(finalRate, processingFee + underwritingFee),
        monthlyPayment: Math.round(amount * (finalRate / 100 / 12) / (1 - Math.pow(1 + finalRate / 100 / 12, -360))),
        processingFee,
        underwritingFee,
        note: "Base pricing - No points"
      },
      {
        lender: "UWM (1% Buydown)",
        rate: Number((finalRate - 0.375).toFixed(3)),
        apr: calculateApr(finalRate - 0.375, processingFee + underwritingFee + (amount * 0.01)),
        monthlyPayment: Math.round(amount * ((finalRate - 0.375) / 100 / 12) / (1 - Math.pow(1 + (finalRate - 0.375) / 100 / 12, -360))),
        processingFee,
        underwritingFee,
        lenderFee: Math.round(amount * 0.01),
        note: "1 Point Buy-down"
      },
      {
        lender: "UWM (2% Buydown)",
        rate: Number((finalRate - 0.75).toFixed(3)),
        apr: calculateApr(finalRate - 0.75, processingFee + underwritingFee + (amount * 0.02)),
        monthlyPayment: Math.round(amount * ((finalRate - 0.75) / 100 / 12) / (1 - Math.pow(1 + (finalRate - 0.75) / 100 / 12, -360))),
        processingFee,
        underwritingFee,
        lenderFee: Math.round(amount * 0.02),
        note: "2 Points Buy-down"
      },
      {
        lender: "Flagstar (0.5% Credit)",
        rate: Number((finalRate + 0.25).toFixed(3)),
        apr: calculateApr(finalRate + 0.25, processingFee + underwritingFee - (amount * 0.005)),
        monthlyPayment: Math.round(amount * ((finalRate + 0.25) / 100 / 12) / (1 - Math.pow(1 + (finalRate + 0.25) / 100 / 12, -360))),
        processingFee,
        underwritingFee,
        lenderCredit: Math.round(amount * 0.005),
        note: "0.5% Credit towards costs"
      },
      {
        lender: "Flagstar (1.0% Credit)",
        rate: Number((finalRate + 0.5).toFixed(3)),
        apr: calculateApr(finalRate + 0.5, processingFee + underwritingFee - (amount * 0.01)),
        monthlyPayment: Math.round(amount * ((finalRate + 0.5) / 100 / 12) / (1 - Math.pow(1 + (finalRate + 0.5) / 100 / 12, -360))),
        processingFee,
        underwritingFee,
        lenderCredit: Math.round(amount * 0.01),
        note: "1.0% Credit towards costs"
      },
      {
        lender: "PRMG (Elite)",
        rate: Number((finalRate - 0.125).toFixed(3)),
        apr: calculateApr(finalRate - 0.125, processingFee + underwritingFee),
        monthlyPayment: Math.round(amount * ((finalRate - 0.125) / 100 / 12) / (1 - Math.pow(1 + (finalRate - 0.125) / 100 / 12, -360))),
        processingFee,
        underwritingFee,
        note: "Elite Pricing Tier"
      }
    ];
  }

  // Get all rate sheets (protected)
  app.get("/api/admin/rate-sheets", requireAdmin, async (req, res) => {
    try {
      const sheets = await storage.getRateSheets();
      res.json(sheets.map(s => ({
        id: s.id,
        lenderName: s.lenderName,
        fileName: s.fileName,
        isActive: s.isActive,
        uploadedAt: s.uploadedAt
      })));
    } catch (err) {
      console.error("Error fetching rate sheets:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Upload rate sheet (protected)
  app.post("/api/admin/rate-sheets", requireAdmin, async (req, res) => {
    try {
      const { lenderName, fileName, fileData } = req.body;
      
      if (!lenderName || !fileName || !fileData) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Check limit of 5 active rate sheets
      const existing = await storage.getRateSheets();
      if (existing.length >= 5) {
        return res.status(400).json({ message: "Maximum of 5 rate sheets allowed. Please delete one first." });
      }

      // Upload to LlamaCloud for parsing
      const { uploadFileToLlamaCloud } = await import('./llamaCloudService');
      const llamaResult = await uploadFileToLlamaCloud(fileData, fileName, lenderName);
      
      if (!llamaResult.success) {
        console.warn("[LlamaCloud] Upload failed, continuing with local storage:", llamaResult.error);
      } else {
        console.log("[LlamaCloud] File uploaded successfully:", llamaResult.documentId);
      }

      const rateSheet = await storage.createRateSheet({
        lenderName,
        fileName,
        fileData,
        isActive: "yes"
      });

      res.status(201).json({
        id: rateSheet.id,
        lenderName: rateSheet.lenderName,
        fileName: rateSheet.fileName,
        isActive: rateSheet.isActive,
        uploadedAt: rateSheet.uploadedAt,
        llamaCloudSync: llamaResult.success
      });
    } catch (err) {
      console.error("Error uploading rate sheet:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete rate sheet (protected)
  app.delete("/api/admin/rate-sheets/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      await storage.deleteRateSheet(id);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting rate sheet:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Toggle rate sheet active status (protected)
  app.patch("/api/admin/rate-sheets/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { isActive } = req.body;
      const updated = await storage.toggleRateSheet(id, isActive);
      res.json({
        id: updated.id,
        lenderName: updated.lenderName,
        fileName: updated.fileName,
        isActive: updated.isActive,
        uploadedAt: updated.uploadedAt
      });
    } catch (err) {
      console.error("Error updating rate sheet:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Sync leads to Google Sheets (protected)
  app.post("/api/admin/sync-sheets", requireAdmin, async (req, res) => {
    try {
      const allLeads = await storage.getLeads();
      const result = await syncLeadsToSheet(allLeads);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (err) {
      console.error("Error syncing to Google Sheets:", err);
      res.status(500).json({ success: false, message: "Failed to sync to Google Sheets" });
    }
  });

  // Get rate sheet parsing status (protected)
  app.get("/api/admin/rate-sheet-status", requireAdmin, async (req, res) => {
    try {
      const activeSheets = await storage.getActiveRateSheets();
      const { parseRateSheet } = await import('./rateSheetParser');
      
      const statuses = await Promise.all(activeSheets.map(async (sheet) => {
        const parsed = await parseRateSheet(sheet.fileData, sheet.fileName, sheet.lenderName);
        return {
          id: sheet.id,
          lenderName: sheet.lenderName,
          fileName: sheet.fileName,
          parseSuccess: parsed.parseSuccess,
          rateCount: parsed.rates.length,
          parseError: parsed.parseError,
        };
      }));
      
      res.json(statuses);
    } catch (err) {
      console.error("Error checking rate sheet status:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Test LlamaCloud connection (protected)
  app.get("/api/admin/llamacloud-status", requireAdmin, async (req, res) => {
    try {
      const { testLlamaCloudConnection } = await import('./llamaCloudService');
      const status = await testLlamaCloudConnection();
      res.json(status);
    } catch (err) {
      console.error("Error checking LlamaCloud status:", err);
      res.json({ connected: false, message: "Error checking connection" });
    }
  });

  // Get lead statistics (protected)
  app.get("/api/admin/lead-stats", requireAdmin, async (req, res) => {
    try {
      const allLeads = await storage.getLeads();
      const now = new Date();
      
      // Calculate start of current week (Sunday)
      const currentWeekStart = new Date(now);
      currentWeekStart.setHours(0, 0, 0, 0);
      currentWeekStart.setDate(now.getDate() - now.getDay());
      
      // Calculate start of previous week
      const previousWeekStart = new Date(currentWeekStart);
      previousWeekStart.setDate(previousWeekStart.getDate() - 7);
      
      // Count leads for each week
      let thisWeekCount = 0;
      let lastWeekCount = 0;
      
      for (const lead of allLeads) {
        if (lead.createdAt) {
          const createdDate = new Date(lead.createdAt);
          if (createdDate >= currentWeekStart) {
            thisWeekCount++;
          } else if (createdDate >= previousWeekStart && createdDate < currentWeekStart) {
            lastWeekCount++;
          }
        }
      }
      
      // Calculate percentage change
      let percentChange = 0;
      if (lastWeekCount > 0) {
        percentChange = Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100);
      } else if (thisWeekCount > 0) {
        percentChange = 100; // All new this week
      }
      
      res.json({
        totalLeads: allLeads.length,
        thisWeek: thisWeekCount,
        lastWeek: lastWeekCount,
        percentChange
      });
    } catch (err) {
      console.error("Error fetching lead stats:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all leads (protected)
  app.get(api.leads.list.path, requireAdmin, async (req, res) => {
    try {
      const allLeads = await storage.getLeads();
      res.json(allLeads);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.leads.create.path, async (req, res) => {
    try {
      const input = api.leads.create.input.parse(req.body);
      
      // Map credit score to pricing engine format
      const creditScoreMap: Record<string, string> = {
        "780+": "excellent",
        "760-780": "excellent",
        "740-759": "good",
        "720-739": "good",
        "700-719": "good",
        "680-699": "fair",
        "640-679": "fair",
        "620-639": "poor",
        "601-619": "poor",
        "580-600": "poor",
        "excellent": "excellent",
        "good": "good",
        "fair": "fair",
        "poor": "poor",
      };
      
      const loanParams: LoanParameters = {
        loanAmount: input.loanAmount,
        propertyValue: input.propertyValue,
        loanTerm: input.loanTerm || "30yr",
        loanType: input.loanType || "conventional",
        propertyType: input.propertyType || "single_family",
        creditScore: creditScoreMap[input.creditScore] || "good",
        loanPurpose: input.loanPurpose,
      };
      
      // Try to calculate rates from uploaded rate sheets first
      const pricingResult = await calculateRates(loanParams);
      
      let rates: Rate[];
      let lenderQuotes: LenderQuote[];
      
      if (pricingResult.quotes.length > 0 && pricingResult.validationPassed) {
        // Use rates from uploaded rate sheets
        lenderQuotes = pricingResult.quotes;
        rates = [];
        
        // Convert lender quotes to Rate format
        for (const quote of lenderQuotes) {
          for (const scenario of quote.scenarios) {
            rates.push({
              lender: quote.lenderName,
              rate: scenario.rate,
              apr: scenario.apr,
              monthlyPayment: scenario.monthlyPayment,
              processingFee: 895,
              underwritingFee: 1245,
              lenderFee: scenario.isCredit ? undefined : scenario.pointsDollar > 0 ? Math.round(scenario.pointsDollar) : undefined,
              lenderCredit: scenario.isCredit ? Math.round(scenario.pointsDollar) : undefined,
              note: scenario.scenarioLabel,
            });
          }
        }
        
        // Log parse errors for admin notification
        if (pricingResult.parseErrors.length > 0) {
          console.warn("Rate sheet parse errors:", pricingResult.parseErrors);
        }
      } else {
        // Fallback to mock rates if no rate sheets available
        lenderQuotes = generateMockQuotes(loanParams);
        rates = [];
        
        for (const quote of lenderQuotes) {
          for (const scenario of quote.scenarios) {
            rates.push({
              lender: quote.lenderName,
              rate: scenario.rate,
              apr: scenario.apr,
              monthlyPayment: scenario.monthlyPayment,
              processingFee: 895,
              underwritingFee: 1245,
              lenderFee: scenario.isCredit ? undefined : scenario.pointsDollar > 0 ? Math.round(scenario.pointsDollar) : undefined,
              lenderCredit: scenario.isCredit ? Math.round(scenario.pointsDollar) : undefined,
              note: scenario.scenarioLabel,
            });
          }
        }
      }
      
      // Sort by rate (lowest first) and limit to 7 rates
      rates.sort((a, b) => a.rate - b.rate);
      rates = rates.slice(0, 7);
      
      // Create lead with quoted rates stored as JSON (with actual lender info for admin)
      const leadWithRates = {
        ...input,
        quotedRates: JSON.stringify(rates.map((r, i) => ({
          optionNumber: i + 1,
          actualLender: r.lender,
          rate: r.rate,
          apr: r.apr,
          monthlyPayment: r.monthlyPayment,
          lenderFee: r.lenderFee,
          lenderCredit: r.lenderCredit,
          note: r.note
        })))
      };
      const lead = await storage.createLeadWithRates(leadWithRates);
      
      // Return rates with masked lender names for customer display
      const maskedRates = rates.map((r, i) => ({
        ...r,
        lender: `Lender ${String.fromCharCode(65 + Math.floor(i / 4))}`, // A, B, C...
        note: r.note || (r.lenderFee ? `${(r.lenderFee / input.loanAmount * 100).toFixed(1)}% Points` :
              r.lenderCredit ? `${(r.lenderCredit / input.loanAmount * 100).toFixed(1)}% Credit` :
              "Par Rate")
      }));
      
      // Don't return quotedRates to customer - strip from lead response
      const safeLeadResponse = {
        ...lead,
        quotedRates: undefined
      };
      
      res.status(201).json({ lead: safeLeadResponse, rates: maskedRates });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      console.error("Error creating lead:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  return httpServer;
}
