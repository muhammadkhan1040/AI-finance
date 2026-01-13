const LLAMA_CLOUD_API_KEY = process.env.LLAMA_CLOUD_API_KEY;
const LLAMA_CLOUD_BASE_URL = "https://api.cloud.llamaindex.ai/api/v1";
const INDEX_NAME = "rate sheets from lenders";
const PROJECT_NAME = "Default";

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

async function makeApiRequest(
  endpoint: string,
  method: string = "GET",
  body?: any
): Promise<Response> {
  const url = `${LLAMA_CLOUD_BASE_URL}${endpoint}`;
  
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${LLAMA_CLOUD_API_KEY}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  console.log(`[LlamaCloud] ${method} ${url}`);
  return fetch(url, options);
}

async function getIndexId(): Promise<string | null> {
  try {
    const response = await makeApiRequest("/pipelines");
    if (!response.ok) {
      console.error("[LlamaCloud] Failed to list pipelines:", response.status);
      return null;
    }
    
    const pipelines = await response.json();
    console.log("[LlamaCloud] Available pipelines:", JSON.stringify(pipelines, null, 2));
    
    for (const pipeline of pipelines) {
      if (pipeline.name === INDEX_NAME || pipeline.name?.toLowerCase().includes("rate")) {
        console.log(`[LlamaCloud] Found index: ${pipeline.name} (${pipeline.id})`);
        return pipeline.id;
      }
    }
    
    if (pipelines.length > 0) {
      console.log(`[LlamaCloud] Using first available pipeline: ${pipelines[0].name}`);
      return pipelines[0].id;
    }
    
    return null;
  } catch (error) {
    console.error("[LlamaCloud] Error getting index ID:", error);
    return null;
  }
}

export async function uploadFileToLlamaCloud(
  fileData: string,
  fileName: string,
  lenderName: string
): Promise<LlamaCloudUploadResult> {
  try {
    if (!LLAMA_CLOUD_API_KEY) {
      return { success: false, error: "LLAMA_CLOUD_API_KEY not configured" };
    }

    console.log(`[LlamaCloud] File ${fileName} for ${lenderName} - files are managed via LlamaCloud UI`);
    
    return {
      success: true,
      documentId: `local-${Date.now()}`
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
  }
): Promise<LlamaCloudQueryResult> {
  try {
    if (!LLAMA_CLOUD_API_KEY) {
      return { rates: [], success: false, error: "LLAMA_CLOUD_API_KEY not configured" };
    }

    const ficoScore = creditScoreToFico(loanParams.creditScore);
    const termYears = loanParams.loanTerm.replace(/[^0-9]/g, '') || "30";
    
    const pipelineId = await getIndexId();
    if (!pipelineId) {
      console.log("[LlamaCloud] No pipeline found, falling back to local parsing");
      return { rates: [], success: false, error: "No LlamaCloud index found" };
    }

    const queryText = `Find all ${loanParams.loanType} ${termYears}-year fixed mortgage rates with their 15-day lock prices. Return the interest rate percentage and price for each rate row. Include conventional, FHA, VA, and jumbo products.`;

    console.log("[LlamaCloud] Query:", queryText);
    console.log("[LlamaCloud] Params:", { ficoScore, ltv: loanParams.ltv, loanType: loanParams.loanType, loanTerm: loanParams.loanTerm });

    const response = await makeApiRequest(`/pipelines/${pipelineId}/retrieve`, "POST", {
      query: queryText,
      retrieval_params: {
        dense_similarity_top_k: 50,
        sparse_similarity_top_k: 10,
        alpha: 0.5,
        enable_reranking: false
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[LlamaCloud] Query failed:", response.status, errorText);
      return { rates: [], success: false, error: `Query failed: ${response.status}` };
    }

    const result = await response.json();
    console.log(`[LlamaCloud] Retrieved response`);

    const rates: LlamaCloudRate[] = [];
    
    const nodes = result.nodes || result.retrieval_nodes || result.items || [];
    
    for (const node of nodes) {
      const text = node.text || node.content || node.node?.text || "";
      const metadata = node.metadata || node.node?.metadata || {};
      
      console.log(`[LlamaCloud] Processing node from: ${metadata.file_name || 'unknown'}`);
      
      const extractedRates = extractRatesFromText(text, metadata, loanParams);
      rates.push(...extractedRates);
    }

    const filteredRates = filterRatesByScenario(rates, loanParams);
    
    console.log(`[LlamaCloud] Extracted ${rates.length} total rates, ${filteredRates.length} after filtering`);
    
    return {
      rates: filteredRates,
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

function extractRatesFromText(
  text: string,
  metadata: any,
  loanParams: { loanType: string; loanTerm: string }
): LlamaCloudRate[] {
  const rates: LlamaCloudRate[] = [];
  const lines = text.split('\n');
  
  let currentLoanType = loanParams.loanType;
  let currentLoanTerm = loanParams.loanTerm;
  
  const lenderName = extractLenderName(metadata.file_name || "");
  
  for (const line of lines) {
    if (/conventional|conforming|agency/i.test(line)) currentLoanType = "conventional";
    if (/fha|federal housing/i.test(line)) currentLoanType = "fha";
    if (/\bva\b|veteran|irrrl/i.test(line)) currentLoanType = "va";
    if (/usda|rural/i.test(line)) currentLoanType = "usda";
    if (/jumbo|non-conforming/i.test(line)) currentLoanType = "jumbo";
    
    if (/30[\s-]*(?:year|yr)/i.test(line)) currentLoanTerm = "30yr";
    if (/25[\s-]*(?:year|yr)/i.test(line)) currentLoanTerm = "25yr";
    if (/20[\s-]*(?:year|yr)/i.test(line)) currentLoanTerm = "20yr";
    if (/15[\s-]*(?:year|yr)/i.test(line)) currentLoanTerm = "15yr";
    
    const rateMatches = line.match(/(\d+\.\d{2,3})%?\s*[,|\s|]+(\d{2,3}\.\d{2,3})/g);
    if (rateMatches) {
      for (const match of rateMatches) {
        const nums = match.match(/(\d+\.\d{2,3})/g);
        if (nums && nums.length >= 2) {
          const potentialRate = parseFloat(nums[0]);
          const potentialPrice = parseFloat(nums[1]);
          
          if (potentialRate >= 4 && potentialRate <= 10 && 
              potentialPrice >= 90 && potentialPrice <= 110) {
            
            const existingRate = rates.find(r => 
              Math.abs(r.interestRate - potentialRate) < 0.001 && 
              r.loanType === currentLoanType &&
              r.loanTerm === currentLoanTerm
            );
            
            if (!existingRate) {
              rates.push({
                interestRate: potentialRate,
                price15Day: potentialPrice,
                loanTerm: currentLoanTerm,
                loanType: currentLoanType,
                lenderName: lenderName
              });
            }
          }
        }
      }
    }
    
    const simpleRatePattern = /^\s*(\d+\.\d{2,3})\s+(\d{2,3}\.\d{2,3})/;
    const simpleMatch = line.match(simpleRatePattern);
    if (simpleMatch) {
      const rate = parseFloat(simpleMatch[1]);
      const price = parseFloat(simpleMatch[2]);
      
      if (rate >= 4 && rate <= 10 && price >= 90 && price <= 110) {
        const exists = rates.find(r => 
          Math.abs(r.interestRate - rate) < 0.001 && 
          r.loanType === currentLoanType &&
          r.loanTerm === currentLoanTerm
        );
        
        if (!exists) {
          rates.push({
            interestRate: rate,
            price15Day: price,
            loanTerm: currentLoanTerm,
            loanType: currentLoanType,
            lenderName: lenderName
          });
        }
      }
    }
  }

  return rates;
}

function extractLenderName(fileName: string): string {
  const lower = fileName.toLowerCase();
  
  if (lower.includes("elend")) return "eLEND";
  if (lower.includes("prmg")) return "PRMG";
  if (lower.includes("wholesale")) return "Wholesale Lender";
  
  const cleanName = fileName.replace(/\.(xlsx?|pdf|csv)$/i, '')
    .replace(/[_-]/g, ' ')
    .replace(/\d{4}[-\/]\d{2}[-\/]\d{2}/g, '')
    .replace(/rate.?sheet/gi, '')
    .trim();
  
  return cleanName || "Lender";
}

function filterRatesByScenario(
  rates: LlamaCloudRate[],
  loanParams: { loanType: string; loanTerm: string; ltv: number; creditScore: string }
): LlamaCloudRate[] {
  const ficoScore = creditScoreToFico(loanParams.creditScore);
  const termKey = loanParams.loanTerm.replace(/[^0-9]/g, '') + "yr";
  
  let filtered = rates.filter(rate => {
    if (rate.loanTerm !== termKey && rate.loanTerm !== loanParams.loanTerm) {
      return false;
    }
    
    if (rate.loanType !== loanParams.loanType && rate.loanType !== "conventional") {
      return false;
    }
    
    if (rate.minFico && ficoScore < rate.minFico) return false;
    if (rate.maxLtv && loanParams.ltv > rate.maxLtv) return false;
    
    return true;
  });
  
  if (filtered.length === 0) {
    filtered = rates.filter(rate => rate.loanTerm === termKey || rate.loanTerm === loanParams.loanTerm);
  }
  
  if (filtered.length === 0) {
    filtered = rates;
  }
  
  const uniqueRates = filtered.filter((rate, index, self) =>
    index === self.findIndex(r => 
      Math.abs(r.interestRate - rate.interestRate) < 0.001 && 
      r.loanTerm === rate.loanTerm && 
      r.loanType === rate.loanType &&
      r.lenderName === rate.lenderName
    )
  );

  uniqueRates.sort((a, b) => a.interestRate - b.interestRate);

  return uniqueRates;
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

export async function testLlamaCloudConnection(): Promise<{ connected: boolean; message: string; indexName?: string }> {
  try {
    if (!LLAMA_CLOUD_API_KEY) {
      return { connected: false, message: "LLAMA_CLOUD_API_KEY not configured" };
    }

    const pipelineId = await getIndexId();
    if (!pipelineId) {
      return { connected: false, message: "No LlamaCloud index found" };
    }
    
    return { connected: true, message: `Connected to LlamaCloud`, indexName: INDEX_NAME };
  } catch (error) {
    return { 
      connected: false, 
      message: error instanceof Error ? error.message : "Connection failed" 
    };
  }
}
