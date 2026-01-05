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
  function getMockRates(score: string, amount: number): Rate[] {
    let baseRate = 6.5; 
    if (score === 'excellent') baseRate -= 0.5;
    if (score === 'good') baseRate -= 0.25;
    if (score === 'fair') baseRate += 0.25;
    if (score === 'poor') baseRate += 1.0;

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
      const rates = getMockRates(input.creditScore, input.loanAmount);
      
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
