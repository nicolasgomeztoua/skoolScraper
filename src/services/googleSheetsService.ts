import { GoogleAuth } from 'google-auth-library';
import { google, sheets_v4 } from 'googleapis';
import { ProcessedPost, SheetData } from '../types';
import { GOOGLE_CREDENTIALS_PATH, GOOGLE_SHEET_ID } from '../config';

export class GoogleSheetsService {
  private sheets: sheets_v4.Sheets;
  private sheetId: string;

  constructor() {
    const auth = new GoogleAuth({
      keyFile: GOOGLE_CREDENTIALS_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    this.sheets = google.sheets({ version: 'v4', auth });
    this.sheetId = GOOGLE_SHEET_ID;
  }

  async initializeSheet(): Promise<void> {
    try {
      // Check if the sheet exists and has the correct headers
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.sheetId,
      });
      
      // Check if we need to create a new sheet for the data
      let sheetExists = false;
      response.data.sheets?.forEach(sheet => {
        if (sheet.properties?.title === 'CommunityProblems') {
          sheetExists = true;
        }
      });
      
      if (!sheetExists) {
        // Add a new sheet
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.sheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: 'CommunityProblems',
                  },
                },
              },
            ],
          },
        });
        
        // Add headers
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.sheetId,
          range: 'CommunityProblems!A1:H1',
          valueInputOption: 'RAW',
          requestBody: {
            values: [['ID', 'Problem', 'Original Content', 'Suggested Solution', 'Tags', 'Category', 'Status', 'Timestamp']],
          },
        });
      }
    } catch (error) {
      console.error('Error initializing Google Sheet:', error);
      throw error;
    }
  }

  async saveToSheet(processedPosts: ProcessedPost[]): Promise<void> {
    try {
      // First, get existing IDs to avoid duplicates
      const existingData = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range: 'CommunityProblems!A:A',
      });
      
      const existingIds = new Set(
        existingData.data.values?.slice(1).map(row => row[0]) || []
      );
      
      // Filter out posts that already exist in the sheet
      const newPosts = processedPosts.filter(post => !existingIds.has(post.id));
      
      if (newPosts.length === 0) {
        console.log('No new posts to add to the sheet');
        return;
      }
      
      // Format the data for the sheet
      const values = newPosts.map(post => {
        const sheetData: SheetData = {
          id: post.id,
          problem: post.problemIdentified,
          originalContent: post.originalContent,
          suggestedSolution: post.potentialSolution || '',
          tags: post.tags?.join(', ') || '',
          category: post.category || '',
          status: 'New',
          timestamp: new Date().toISOString(),
        };
        
        return [
          sheetData.id,
          sheetData.problem,
          sheetData.originalContent,
          sheetData.suggestedSolution,
          sheetData.tags,
          sheetData.category,
          sheetData.status,
          sheetData.timestamp,
        ];
      });
      
      // Append to the sheet
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.sheetId,
        range: 'CommunityProblems!A:H',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values,
        },
      });
      
      console.log(`Added ${values.length} new posts to the Google Sheet`);
    } catch (error) {
      console.error('Error saving to Google Sheet:', error);
      throw error;
    }
  }
} 