import axios from 'axios';
import { ProcessedPost, SheetData } from '../types';
import { SHEETDB_API_ENDPOINT, SHEETDB_AUTH_TOKEN } from '../config';

export class SheetDbService {
  private apiUrl: string;
  private authToken: string;

  constructor() {
    this.apiUrl = SHEETDB_API_ENDPOINT;
    this.authToken = SHEETDB_AUTH_TOKEN;
  }

  // SheetDB expects keys matching the sheet's header row
  private mapPostToSheetRow(post: ProcessedPost): Record<string, any> {
    const sheetData: SheetData = {
      id: post.sheetId,
      problem: post.problemIdentified,
      originalContent: post.originalContent,
      suggestedSolution: post.suggestedSolution || '',
      tags: post.tags?.join(', ') || '',
      category: post.category || '',
      status: 'New', // You can customize this default status
      timestamp: new Date().toISOString(),
      authorName: post.authorName || '',
      postTimestamp: post.postTimestamp || '',
      postUrl: post.postUrl || '',
      communityUrl: post.communityUrl || ''
    };
    return sheetData;
  }

  async saveToSheet(processedPosts: ProcessedPost[]): Promise<void> {
    if (processedPosts.length === 0) {
      console.log('No new posts to add to SheetDB.');
      return;
    }

    // Map posts to the row format expected by SheetDB
    const dataPayload = processedPosts.map(this.mapPostToSheetRow);

    try {
      // Send data to SheetDB API with Authorization header
      console.log(`Attempting to send ${dataPayload.length} rows to SheetDB...`);
      const response = await axios.post(this.apiUrl, { data: dataPayload }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      // SheetDB usually returns a count of created rows
      if (response.data && response.data.created) {
        console.log(`Successfully added ${response.data.created} rows to SheetDB.`);
      } else {
        console.log('Data sent to SheetDB successfully (status code indicates success).');
      }

    } catch (error: any) {
      console.error('Error saving to SheetDB:');
      if (axios.isAxiosError(error) && error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
        if (error.response.status === 401) {
          console.error('Authorization failed. Check your SHEETDB_AUTH_TOKEN.');
        }
      } else {
        console.error(error.message);
      }
      // Consider re-throwing if you want the main loop to know about the failure
      // throw new Error('Failed to save data to SheetDB'); 
    }
  }
} 