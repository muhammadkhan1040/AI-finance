import * as XLSX from 'xlsx';

export interface ParsedRate {
  rate: number;
  price15Day: number;
  price30Day: number;
  price45Day: number;
  loanTerm: string;
  loanType: string;
}

export interface ParsedRateSheet {
  lenderName: string;
  rates: ParsedRate[];
  parseSuccess: boolean;
  parseError?: string;
}

const LOAN_TERM_PATTERNS: Record<string, RegExp[]> = {
  "30yr": [/30\s*year/i, /30yr/i, /30-year/i, /30\s*yr/i, /30\s*-\s*26\s*year/i],
  "25yr": [/25\s*year/i, /25yr/i, /25-year/i, /25\s*yr/i, /25\s*-\s*21\s*year/i],
  "20yr": [/20\s*year/i, /20yr/i, /20-year/i, /20\s*yr/i, /20\s*-\s*16\s*year/i],
  "15yr": [/15\s*year/i, /15yr/i, /15-year/i, /15\s*yr/i, /15\s*-\s*11\s*year/i],
};

const LOAN_TYPE_PATTERNS: Record<string, RegExp[]> = {
  "conventional": [/conventional/i, /agency/i, /conforming/i],
  "fha": [/fha/i, /federal\s*housing/i],
  "va": [/\bva\b/i, /veteran/i, /irrrl/i],
  "jumbo": [/jumbo/i, /non-conforming/i, /jumbo\s*smart/i],
  "usda": [/usda/i, /rural/i],
  "dscr": [/dscr/i, /debt\s*service/i, /investor/i],
};

function detectLoanTerm(text: string): string | null {
  for (const [term, patterns] of Object.entries(LOAN_TERM_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return term;
      }
    }
  }
  return null;
}

function detectLoanType(text: string): string | null {
  for (const [type, patterns] of Object.entries(LOAN_TYPE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return type;
      }
    }
  }
  return null;
}

export async function parseExcelRateSheet(fileData: string, lenderName: string): Promise<ParsedRateSheet> {
  try {
    const base64Data = fileData.replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    const rates: ParsedRate[] = [];
    
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      
      let currentLoanTerm = "30yr";
      let currentLoanType = "conventional";
      
      for (let rowIdx = 0; rowIdx < jsonData.length; rowIdx++) {
        const row = jsonData[rowIdx];
        if (!row || row.length === 0) continue;
        
        const rowText = row.map(cell => String(cell || '')).join(' ');
        
        const detectedTerm = detectLoanTerm(rowText);
        if (detectedTerm) {
          currentLoanTerm = detectedTerm;
        }
        
        const detectedType = detectLoanType(rowText);
        if (detectedType) {
          currentLoanType = detectedType;
        }
        
        const rateCell = row[0];
        if (typeof rateCell === 'number' && rateCell >= 3 && rateCell <= 12) {
          const price15 = typeof row[1] === 'number' ? row[1] : parseFloat(String(row[1]));
          const price30 = typeof row[2] === 'number' ? row[2] : parseFloat(String(row[2]));
          const price45 = typeof row[3] === 'number' ? row[3] : parseFloat(String(row[3]));
          
          if (!isNaN(price15) && price15 > 90 && price15 < 110) {
            rates.push({
              rate: rateCell,
              price15Day: price15,
              price30Day: !isNaN(price30) && price30 > 90 ? price30 : price15,
              price45Day: !isNaN(price45) && price45 > 90 ? price45 : price15,
              loanTerm: currentLoanTerm,
              loanType: currentLoanType,
            });
          }
        }
      }
    }
    
    return {
      lenderName,
      rates,
      parseSuccess: rates.length > 0,
      parseError: rates.length === 0 ? "No valid rates found in Excel file" : undefined,
    };
  } catch (error) {
    return {
      lenderName,
      rates: [],
      parseSuccess: false,
      parseError: `Excel parse error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export async function parsePdfRateSheet(fileData: string, lenderName: string): Promise<ParsedRateSheet> {
  try {
    const base64Data = fileData.replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Dynamic import for pdf-parse (CommonJS module)
    const pdfParse = await import('pdf-parse');
    const pdf = pdfParse.default || pdfParse;
    const pdfData = await pdf(buffer);
    const text = pdfData.text;
    
    const rates: ParsedRate[] = [];
    const lines = text.split('\n');
    
    let currentLoanTerm = "30yr";
    let currentLoanType = "conventional";
    
    for (const line of lines) {
      const detectedTerm = detectLoanTerm(line);
      if (detectedTerm) {
        currentLoanTerm = detectedTerm;
      }
      
      const detectedType = detectLoanType(line);
      if (detectedType) {
        currentLoanType = detectedType;
      }
      
      const numbers = line.match(/\d+\.\d{2,3}/g);
      if (numbers && numbers.length >= 2) {
        const potentialRate = parseFloat(numbers[0]);
        const potentialPrice = parseFloat(numbers[1]);
        
        if (potentialRate >= 3 && potentialRate <= 12 && 
            potentialPrice >= 90 && potentialPrice <= 110) {
          
          const price15 = potentialPrice;
          const price30 = numbers[2] ? parseFloat(numbers[2]) : potentialPrice;
          const price45 = numbers[3] ? parseFloat(numbers[3]) : potentialPrice;
          
          const existingRate = rates.find(r => 
            r.rate === potentialRate && 
            r.loanTerm === currentLoanTerm && 
            r.loanType === currentLoanType
          );
          
          if (!existingRate) {
            rates.push({
              rate: potentialRate,
              price15Day: price15 >= 90 && price15 <= 110 ? price15 : 100,
              price30Day: price30 >= 90 && price30 <= 110 ? price30 : price15,
              price45Day: price45 >= 90 && price45 <= 110 ? price45 : price15,
              loanTerm: currentLoanTerm,
              loanType: currentLoanType,
            });
          }
        }
      }
    }
    
    return {
      lenderName,
      rates,
      parseSuccess: rates.length > 0,
      parseError: rates.length === 0 ? "No valid rates found in PDF. Please upload Excel version." : undefined,
    };
  } catch (error) {
    return {
      lenderName,
      rates: [],
      parseSuccess: false,
      parseError: `PDF parse error: ${error instanceof Error ? error.message : 'Unknown error'}. Please use Excel format.`,
    };
  }
}

export async function parseRateSheet(fileData: string, fileName: string, lenderName: string): Promise<ParsedRateSheet> {
  const lowerFileName = fileName.toLowerCase();
  
  if (lowerFileName.endsWith('.xlsx') || lowerFileName.endsWith('.xls')) {
    return parseExcelRateSheet(fileData, lenderName);
  } else if (lowerFileName.endsWith('.pdf')) {
    return parsePdfRateSheet(fileData, lenderName);
  } else if (lowerFileName.endsWith('.csv')) {
    return parseExcelRateSheet(fileData, lenderName);
  }
  
  return {
    lenderName,
    rates: [],
    parseSuccess: false,
    parseError: `Unsupported file format: ${fileName}`,
  };
}
