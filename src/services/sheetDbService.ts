import axios from 'axios';
import { ProcessedPost, SheetData } from '../types';
import { APPS_SCRIPT_WEB_APP_URL } from '../config';

export class SheetDbService {
  private appsScriptUrl: string;

  constructor() {
    this.appsScriptUrl = APPS_SCRIPT_WEB_APP_URL;
  }

  // Helper to convert ProcessedPost to a flat array matching header order
  private mapPostToRowArray(post: ProcessedPost): any[] {
    // Order MUST match REQUIRED_HEADERS in Apps Script
    return [
      post.sheetId,                    // id
      post.problemIdentified,          // problem
      post.originalContent,            // originalContent
      post.suggestedSolution || '',    // suggestedSolution
      post.tags?.join(', ') || '',     // tags (comma-separated string)
      post.category || '',             // category
      'New',                           // status (default)
      new Date().toISOString(),        // timestamp (when added)
      post.authorName || '',          // authorName
      post.postTimestamp || '',       // postTimestamp
      post.postUrl || '',             // postUrl
      post.communityUrl || ''         // communityUrl
    ];
  }

  // Fetch existing post IDs from the specific sheet via Apps Script
  async getExistingPostIds(sheetName: string): Promise<Set<string>> {
    const existingIds = new Set<string>();
    console.log(`Fetching existing post IDs from sheet '${sheetName}' via Apps Script...`);
    try {
      const response = await axios.get(this.appsScriptUrl, {
        params: {
          action: 'getIds',
          sheet: sheetName
        }
        // No Authorization header needed for Apps Script Web App (if deployed as 'Anyone')
      });

      // Expect { existingIds: [...] } from Apps Script
      if (response.data && Array.isArray(response.data.existingIds)) {
         response.data.existingIds.forEach((id: any) => {
           if (typeof id === 'string' && id.trim() !== '') {
             existingIds.add(id.trim());
           }
         });
         console.log(`Found ${existingIds.size} existing post IDs in sheet '${sheetName}'.`);
      } else {
          console.warn(`Unexpected response format from Apps Script getIds for sheet '${sheetName}'. Expected { existingIds: [...] }, got:`, response.data);
      }
      return existingIds;

    } catch (error: any) {
      console.error(`Error fetching existing post IDs via Apps Script for sheet '${sheetName}':`);
      if (axios.isAxiosError(error) && error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data); // Apps Script might return { error: ... }
      } else {
        console.error(error.message);
      }
      console.warn(`Proceeding without filtering duplicates for sheet '${sheetName}' due to Apps Script error.`);
      return existingIds; // Return empty set on error
    }
  }

  // Save posts to a specific sheet via Apps Script
  async saveToSheet(processedPosts: ProcessedPost[], sheetName: string): Promise<void> {
    if (processedPosts.length === 0) {
      console.log(`No new posts to add to sheet '${sheetName}'.`);
      return;
    }

    // Map posts to the 2D array format expected by Apps Script
    const dataPayload = processedPosts.map(this.mapPostToRowArray);

    // Construct the URL with parameters
    const targetUrl = this.appsScriptUrl;
    const params = {
      action: 'saveData',
      sheet: sheetName
    };

    try {
      console.log(`Attempting to send ${dataPayload.length} rows to sheet '${sheetName}' via Apps Script...`);
      const response = await axios.post(targetUrl, 
        { data: dataPayload }, // Send data in the expected { data: [...] } format
        {
          params: params, // Add params to the request config
          headers: {
            'Content-Type': 'application/json' // Ensure correct content type
             // No Authorization header needed
          }
         }
      );

      // Expect { created: ... } or { error: ... } from Apps Script
      if (response.data && typeof response.data.created === 'number') {
        console.log(`Apps Script reported adding ${response.data.created} rows to sheet '${sheetName}'.`);
      } else if (response.data && response.data.error) {
         console.error(`Apps Script reported an error saving to sheet '${sheetName}': ${response.data.error}`);
         throw new Error(`Apps Script error saving data: ${response.data.error}`);
      } else {
        console.warn(`Unexpected response format from Apps Script saveData for sheet '${sheetName}':`, response.data);
      }

    } catch (error: any) {
      console.error(`Error saving to sheet '${sheetName}' via Apps Script:`);
      if (axios.isAxiosError(error) && error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
      } else if (error.message.includes('Apps Script error saving data')) {
        // Error already logged, maybe re-throw if needed by caller
      } else {
        console.error(error.message);
      }
      // Re-throw the error so the main loop knows something failed
      throw new Error(`Failed to save data to sheet '${sheetName}' via Apps Script.`);
    }
  }

  // NEW: Save pre-formatted generated data rows to a specific sheet via Apps Script
  async saveGeneratedData(generatedDataRows: any[][], sheetName: string): Promise<void> {
    if (generatedDataRows.length === 0) {
      console.log(`No generated data rows to add to sheet '${sheetName}'.`);
      return;
    }

    // Data is already formatted as a 2D array
    const dataPayload = generatedDataRows;

    // Construct the URL with parameters
    const targetUrl = this.appsScriptUrl;
    const params = {
      action: 'saveData',
      sheet: sheetName
    };

    try {
      console.log(`Attempting to send ${dataPayload.length} generated rows to sheet '${sheetName}' via Apps Script...`);
      // Use the same POST request structure as saveToSheet, but with pre-formatted data
      const response = await axios.post(targetUrl, 
        { data: dataPayload }, // Send pre-formatted data in { data: [...] }
        {
          params: params,
          headers: { 'Content-Type': 'application/json' }
         }
      );

      if (response.data && typeof response.data.created === 'number') {
        console.log(`Apps Script reported adding ${response.data.created} generated rows to sheet '${sheetName}'.`);
      } else if (response.data && response.data.error) {
         console.error(`Apps Script reported an error saving generated data to sheet '${sheetName}': ${response.data.error}`);
         throw new Error(`Apps Script error saving generated data: ${response.data.error}`);
      } else {
        console.warn(`Unexpected response format from Apps Script saveData (generated) for sheet '${sheetName}':`, response.data);
      }
    } catch (error: any) {
      console.error(`Error saving generated data to sheet '${sheetName}' via Apps Script:`);
      if (axios.isAxiosError(error) && error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
      } else if (error.message.includes('Apps Script error saving generated data')) {
        // Error already logged
      } else {
        console.error(error.message);
      }
      throw new Error(`Failed to save generated data to sheet '${sheetName}' via Apps Script.`);
    }
  }

  // Fetch all data rows from a specific sheet via Apps Script
  async getSheetData(sheetName: string): Promise<any[][]> {
    console.log(`Fetching all data from sheet '${sheetName}' via Apps Script...`);
    try {
      const response = await axios.get(this.appsScriptUrl, {
        params: {
          action: 'getSheetData',
          sheet: sheetName
        }
      });

      // Expect { sheetData: [...] } from Apps Script (array of arrays)
      if (response.data && Array.isArray(response.data.sheetData)) {
         console.log(`Received ${response.data.sheetData.length} data rows from sheet '${sheetName}'.`);
         return response.data.sheetData;
      } else {
          console.warn(`Unexpected response format from Apps Script getSheetData for sheet '${sheetName}'. Expected { sheetData: [...] }, got:`, response.data);
          return []; // Return empty array on unexpected format
      }
    } catch (error: any) {
      console.error(`Error fetching sheet data via Apps Script for sheet '${sheetName}':`);
      if (axios.isAxiosError(error) && error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
      } else {
        console.error(error.message);
      }
      console.warn(`Returning empty data for sheet '${sheetName}' due to Apps Script error.`);
      return []; // Return empty array on error
    }
  }

  // Update the status of a post in a specific sheet via Apps Script
  async updatePostStatus(sheetName: string, postId: string, newStatus: string): Promise<boolean> {
    console.log(`Attempting to update status to '${newStatus}' for postId '${postId}' in sheet '${sheetName}'...`);
    try {
      const response = await axios.post(this.appsScriptUrl,
        { postId: postId, newStatus: newStatus }, // Send required data in body
        {
          params: {
            action: 'updateStatus',
            sheet: sheetName
          },
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      // Expect { success: true/false } or { error: ... }
      if (response.data && typeof response.data.success === 'boolean') {
        console.log(`Apps Script update status result for postId '${postId}': ${response.data.success}`);
        return response.data.success;
      } else if (response.data && response.data.error) {
         console.error(`Apps Script reported an error updating status for postId '${postId}': ${response.data.error}`);
         return false;
      } else {
        console.warn(`Unexpected response format from Apps Script updateStatus:`, response.data);
        return false;
      }
    } catch (error: any) {
      console.error(`Error calling Apps Script updateStatus for postId '${postId}' in sheet '${sheetName}':`);
       if (axios.isAxiosError(error) && error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
      } else {
        console.error(error.message);
      }
      return false; // Return false on error
    }
  }
} 