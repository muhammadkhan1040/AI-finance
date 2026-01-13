const LLAMA_CLOUD_API_KEY = process.env.LLAMA_CLOUD_API_KEY;
const LLAMA_CLOUD_BASE_URL = "https://api.cloud.llamaindex.ai/api/v1";

export interface LlamaCloudRate {
  interestRate: number;
  price15Day: number;
  price30Day?: number;
  price45Day?: number;
  loanTerm: string;
  loanType: string;
  minFico?: number;
  maxLtv?: number;
  loanPurpose?: string;
  lenderName?: string;
}

export interface LlamaCloudQueryResult {
  rates: LlamaCloudRate[];
  success: boolean;
  error?: string;
  rawResponse?: any;
}

export interface LlamaCloudUploadResult {
  success: boolean;
  documentId?: string;
  error?: string;
}

export interface LlamaCloudIndexStatus {
  ready: boolean;
  successCount: number;
  pendingCount: number;
  errorCount: number;
}

async function makeApiRequest(
  endpoint: string,
  method: string = "GET",
  body?: any
): Promise<Response> {
  const url = `${LLAMA_CLOUD_BASE_URL}${endpoint}`;
  
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${LLAMA_CLOUD_API_KEY}`,
    "Content-Type": "application/json",
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  return fetch(url, options);
}

export async function uploadFileToLlamaCloud(
  fileData: string,
  fileName: string,
  lenderName: string,
  indexName: string = "mortgage-rate-sheets"
): Promise<LlamaCloudUploadResult> {
  try {
    if (!LLAMA_CLOUD_API_KEY) {
      return { success: false, error: "LLAMA_CLOUD_API_KEY not configured" };
    }

    const base64Data = fileData.replace(/^data:.*?;base64,/, '');
    
    const response = await makeApiRequest(`/indices/${indexName}/documents`, "POST", {
      file: {
        content: base64Data,
        filename: fileName,
        encoding: "base64"
      },
      metadata: {
        lenderName,
        uploadedAt: new Date().toISOString(),
        fileType: fileName.split('.').pop()?.toLowerCase()
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[LlamaCloud] Upload failed:", errorText);
      return { success: false, error: `Upload failed: ${response.status} ${errorText}` };
    }

    const result = await response.json();
    console.log("[LlamaCloud] Upload successful:", result);
    
    return {
      success: true,
      documentId: result.id || result.document_id
    };
  } catch (error) {
    console.error("[LlamaCloud] Upload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown upload error"
    };
  }
}

export async function queryLlamaCloudForRates(
  loanParams: {
    creditScore: string;
    ltv: number;
    loanPurpose: string;
    loanType: string;
    loanTerm: string;
  },
  indexName: string = "mortgage-rate-sheets"
): Promise<LlamaCloudQueryResult> {
  try {
    if (!LLAMA_CLOUD_API_KEY) {
      return { rates: [], success: false, error: "LLAMA_CLOUD_API_KEY not configured" };
    }

    const ficoScore = creditScoreToFico(loanParams.creditScore);
    
    const queryText = `Find all mortgage rates for a ${loanParams.loanType} ${loanParams.loanTerm} loan with LTV of ${loanParams.ltv.toFixed(1)}% and FICO score ${ficoScore}. Purpose: ${loanParams.loanPurpose}. Return the interest rate, 15-day lock price, 30-day lock price, 45-day lock price, loan term, and loan type for each matching rate row.`;

    console.log("[LlamaCloud] Query:", queryText);

    const response = await makeApiRequest(`/indices/${indexName}/retrieve`, "POST", {
      query: queryText,
      similarity_top_k: 50,
      retrieval_mode: "dense",
      filters: {
        loanType: loanParams.loanType,
        loanTerm: loanParams.loanTerm
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[LlamaCloud] Query failed:", errorText);
      return { rates: [], success: false, error: `Query failed: ${response.status}` };
    }

    const result = await response.json();
    console.log("[LlamaCloud] Raw response:", JSON.stringify(result, null, 2));

    const rates = parseRatesFromResponse(result, loanParams);
    
    return {
      rates,
      success: true,
      rawResponse: result
    };
  } catch (error) {
    console.error("[LlamaCloud] Query error:", error);
    return {
      rates: [],
      success: false,
      error: error instanceof Error ? error.message : "Unknown query error"
    };
  }
}

function creditScoreToFico(creditScore: string): number {
  const scoreMap: Record<string, number> = {
    "780+": 790,
    "760-780": 770,
    "760-779": 770,
    "740-759": 750,
    "720-739": 730,
    "700-719": 710,
    "680-699": 690,
    "660-679": 670,
    "640-679": 660,
    "620-639": 630,
    "601-619": 610,
    "580-600": 590,
    "excellent": 780,
    "good": 720,
    "fair": 680,
    "poor": 620
  };
  return scoreMap[creditScore] || 700;
}

function parseRatesFromResponse(
  response: any,
  loanParams: { loanType: string; loanTerm: string; ltv: number; creditScore: string }
): LlamaCloudRate[] {
  const rates: LlamaCloudRate[] = [];
  const ficoScore = creditScoreToFico(loanParams.creditScore);
  
  if (!response || !response.nodes) {
    if (response?.text) {
      return parseRatesFromText(response.text, loanParams);
    }
    return rates;
  }

  for (const node of response.nodes) {
    const text = node.text || node.content || "";
    const metadata = node.metadata || {};
    
    const extractedRates = extractRatesFromText(text, metadata, loanParams);
    rates.push(...extractedRates);
  }

  const filteredRates = rates.filter(rate => {
    if (rate.minFico && ficoScore < rate.minFico) return false;
    if (rate.maxLtv && loanParams.ltv > rate.maxLtv) return false;
    return true;
  });

  const uniqueRates = filteredRates.filter((rate, index, self) =>
    index === self.findIndex(r => 
      r.interestRate === rate.interestRate && 
      r.loanTerm === rate.loanTerm && 
      r.loanType === rate.loanType
    )
  );

  uniqueRates.sort((a, b) => a.interestRate - b.interestRate);

  return uniqueRates;
}

function parseRatesFromText(
  text: string,
  loanParams: { loanType: string; loanTerm: string }
): LlamaCloudRate[] {
  return extractRatesFromText(text, {}, loanParams);
}

function extractRatesFromText(
  text: string,
  metadata: any,
  loanParams: { loanType: string; loanTerm: string }
): LlamaCloudRate[] {
  const rates: LlamaCloudRate[] = [];
  
  const ratePattern = /(\d+\.\d{2,3})%?\s*[,|\s]+(\d{2,3}\.\d{2,3})/g;
  let match;
  
  while ((match = ratePattern.exec(text)) !== null) {
    const interestRate = parseFloat(match[1]);
    const price = parseFloat(match[2]);
    
    if (interestRate >= 3 && interestRate <= 12 && price >= 90 && price <= 110) {
      rates.push({
        interestRate,
        price15Day: price,
        loanTerm: metadata.loanTerm || loanParams.loanTerm,
        loanType: metadata.loanType || loanParams.loanType,
        lenderName: metadata.lenderName
      });
    }
  }

  const jsonPattern = /\{[^{}]*"(?:interest_?rate|rate)":\s*[\d.]+[^{}]*\}/gi;
  const jsonMatches = text.match(jsonPattern) || [];
  
  for (const jsonStr of jsonMatches) {
    try {
      const obj = JSON.parse(jsonStr);
      const rate = obj.interest_rate || obj.interestRate || obj.rate;
      const price = obj.price_15_day || obj.price15Day || obj.price || obj.price_15day;
      
      if (rate && price && rate >= 3 && rate <= 12 && price >= 90 && price <= 110) {
        rates.push({
          interestRate: rate,
          price15Day: price,
          price30Day: obj.price_30_day || obj.price30Day,
          price45Day: obj.price_45_day || obj.price45Day,
          loanTerm: obj.loan_term || obj.loanTerm || loanParams.loanTerm,
          loanType: obj.loan_type || obj.loanType || loanParams.loanType,
          minFico: obj.min_fico || obj.minFico,
          maxLtv: obj.max_ltv || obj.maxLtv,
          lenderName: obj.lender_name || obj.lenderName || metadata.lenderName
        });
      }
    } catch (e) {
    }
  }

  return rates;
}

export async function checkIndexStatus(
  indexName: string = "mortgage-rate-sheets"
): Promise<LlamaCloudIndexStatus> {
  try {
    if (!LLAMA_CLOUD_API_KEY) {
      return { ready: false, successCount: 0, pendingCount: 0, errorCount: 0 };
    }

    const response = await makeApiRequest(`/indices/${indexName}/status`);
    
    if (!response.ok) {
      return { ready: false, successCount: 0, pendingCount: 0, errorCount: 0 };
    }

    const result = await response.json();
    
    return {
      ready: result.success_count >= 1,
      successCount: result.success_count || 0,
      pendingCount: result.pending_count || 0,
      errorCount: result.error_count || 0
    };
  } catch (error) {
    console.error("[LlamaCloud] Status check error:", error);
    return { ready: false, successCount: 0, pendingCount: 0, errorCount: 0 };
  }
}

export function selectBestRate(rates: LlamaCloudRate[]): LlamaCloudRate | null {
  if (rates.length === 0) return null;
  
  const parRates = rates.filter(r => {
    const pointsFromPar = 100 - r.price15Day;
    return Math.abs(pointsFromPar) < 0.5;
  });
  
  if (parRates.length > 0) {
    return parRates.reduce((best, current) => 
      current.interestRate < best.interestRate ? current : best
    );
  }
  
  return rates.reduce((best, current) => 
    current.interestRate < best.interestRate ? current : best
  );
}
