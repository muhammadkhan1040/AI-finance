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
    if (term === '15yr') baseRate -= 0.5;
    if (term === '10yr') baseRate -= 0.75;
    if (term === '20yr') baseRate -= 0.25;
    
    // Map new ranges to rate adjustments
    if (score === '780+') baseRate -= 0.625;
    else if (score === '760-780') baseRate -= 0.5;
    else if (score === '740-759') baseRate -= 0.375;
    else if (score === '720-739') baseRate -= 0.25;
    else if (score === '700-719') baseRate -= 0.125;
    else if (score === '680-699') baseRate += 0;
    else if (score === '640-679') baseRate += 0.125;
    else if (score === '620-639') baseRate += 0.25;
    else if (score === '601-619') baseRate += 0.5;
    else if (score === '580-600') baseRate += 0.75;
    else {
      // Fallback for old values if any
      if (score === 'excellent') baseRate -= 0.5;
      if (score === 'good') baseRate -= 0.25;
      if (score === 'fair') baseRate += 0.25;
      if (score === 'poor') baseRate += 1.0;
    }

    // Adjust for DSCR
    if (term === 'dscr') baseRate += 0.75;

    return [
      {
        lender: "Rocket Mortgage",
        rate: Number((baseRate + 0.125).toFixed(3)),
        apr: Number((baseRate + 0.25).toFixed(3)),
        monthlyPayment: Math.round(amount * ((baseRate + 0.125) / 100 / 12) / (1 - Math.pow(1 + (baseRate + 0.125) / 100 / 12, -360))),
        processingFee: 895,
        underwritingFee: 1100
      },
      {
        lender: "Better.com",
        rate: Number((baseRate).toFixed(3)),
        apr: Number((baseRate + 0.15).toFixed(3)),
        monthlyPayment: Math.round(amount * ((baseRate) / 100 / 12) / (1 - Math.pow(1 + (baseRate) / 100 / 12, -360))),
        processingFee: 895,
        underwritingFee: 1100
      },
      {
        lender: "LoanDepot",
        rate: Number((baseRate - 0.125).toFixed(3)),
        apr: Number((baseRate + 0.1).toFixed(3)),
        monthlyPayment: Math.round(amount * ((baseRate - 0.125) / 100 / 12) / (1 - Math.pow(1 + (baseRate - 0.125) / 100 / 12, -360))),
        processingFee: 895,
        underwritingFee: 1100
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
