import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { type Rate } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
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
    
    // APR Calculation: (Interest + Fees) / Principal / Time
    const baseApr = finalRate + 0.15;

    return [
      {
        lender: "PRMG (Base)",
        rate: finalRate,
        apr: Number(baseApr.toFixed(3)),
        monthlyPayment: Math.round(amount * (finalRate / 100 / 12) / (1 - Math.pow(1 + finalRate / 100 / 12, -360))),
        processingFee: processingFee,
        underwritingFee: underwritingFee,
        note: "Standard base pricing"
      },
      {
        lender: "UWM (1% Buydown)",
        rate: Number((finalRate - 0.375).toFixed(3)),
        apr: Number((baseApr - 0.375 + 0.033).toFixed(3)), // APR slightly higher due to fee
        monthlyPayment: Math.round(amount * ((finalRate - 0.375) / 100 / 12) / (1 - Math.pow(1 + (finalRate - 0.375) / 100 / 12, -360))),
        processingFee: processingFee,
        underwritingFee: underwritingFee,
        lenderFee: Math.round(amount * 0.01),
        note: "Lower rate with 1% buydown"
      },
      {
        lender: "Flagstar (0.5% Credit)",
        rate: Number((finalRate + 0.25).toFixed(3)),
        apr: Number((baseApr + 0.25 - 0.016).toFixed(3)), // APR slightly lower due to credit
        monthlyPayment: Math.round(amount * ((finalRate + 0.25) / 100 / 12) / (1 - Math.pow(1 + (finalRate + 0.25) / 100 / 12, -360))),
        processingFee: processingFee,
        underwritingFee: underwritingFee,
        lenderCredit: Math.round(amount * 0.005),
        note: "0.5% lender credit towards closing"
      }
    ];
  }

  app.post(api.leads.create.path, async (req, res) => {
    try {
      const input = api.leads.create.input.parse(req.body);
      const lead = await storage.createLead(input);
      const rates = getMockRates(input.creditScore, input.loanAmount, input.loanTerm);
      
      res.status(201).json({ lead, rates });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  return httpServer;
}
