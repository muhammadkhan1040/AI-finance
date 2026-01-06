// Google Sheets integration for lead export
// Uses Replit connector for authentication

import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-sheet',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Sheet not connected');
  }
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
async function getUncachableGoogleSheetClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.sheets({ version: 'v4', auth: oauth2Client });
}

// The spreadsheet ID from the user's Google Sheet URL
const SPREADSHEET_ID = '1PBWCv1QPtnAFYmbpWayyzWS8b3cf0qYvArw_-q3wxDk';

// Headers for the lead data
const HEADERS = [
  'ID',
  'First Name',
  'Last Name',
  'Email',
  'Phone',
  'Loan Purpose',
  'Property Type',
  'Property Value',
  'Loan Amount',
  'Loan Type',
  'Loan Term',
  'Credit Score',
  'Annual Income',
  'Zip Code',
  'First Time Buyer',
  'Created At',
  'Quoted Rates'
];

interface Lead {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  loanPurpose: string;
  propertyType: string;
  propertyValue: number;
  loanAmount: number;
  loanType: string;
  loanTerm: string;
  creditScore: string;
  annualIncome: number;
  zipCode: string;
  isFirstTimeBuyer: string;
  createdAt: Date | string | null;
  quotedRates: string | null;
}

function formatLeadRow(lead: Lead): (string | number)[] {
  return [
    lead.id,
    lead.firstName,
    lead.lastName,
    lead.email,
    lead.phone,
    lead.loanPurpose,
    lead.propertyType,
    lead.propertyValue,
    lead.loanAmount,
    lead.loanType,
    lead.loanTerm,
    lead.creditScore,
    lead.annualIncome,
    lead.zipCode,
    lead.isFirstTimeBuyer === 'yes' ? 'Yes' : 'No',
    lead.createdAt ? new Date(lead.createdAt).toISOString() : '',
    lead.quotedRates || ''
  ];
}

export async function syncLeadsToSheet(leads: Lead[]): Promise<{ success: boolean; message: string; rowsWritten?: number }> {
  try {
    const sheets = await getUncachableGoogleSheetClient();
    
    // Clear existing data and write fresh
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A:Q',
    });
    
    // Prepare data with headers
    const values = [
      HEADERS,
      ...leads.map(formatLeadRow)
    ];
    
    // Write data to sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values
      }
    });
    
    return { 
      success: true, 
      message: `Successfully synced ${leads.length} leads to Google Sheets`,
      rowsWritten: leads.length 
    };
  } catch (error: any) {
    console.error('Google Sheets sync error:', error);
    return { 
      success: false, 
      message: error.message || 'Failed to sync to Google Sheets' 
    };
  }
}

export async function appendLeadToSheet(lead: Lead): Promise<{ success: boolean; message: string }> {
  try {
    const sheets = await getUncachableGoogleSheetClient();
    
    // Append single row
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A:Q',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [formatLeadRow(lead)]
      }
    });
    
    return { 
      success: true, 
      message: 'Lead added to Google Sheets' 
    };
  } catch (error: any) {
    console.error('Google Sheets append error:', error);
    return { 
      success: false, 
      message: error.message || 'Failed to append to Google Sheets' 
    };
  }
}
