import './env'; // Import to initialize and validate env vars early
import { SKOOL_COMMUNITY_URLS } from './config'; // Import the URLs
import { SkoolScraper } from './services/skoolScraper';
import { GeminiService } from './services/geminiService';
import { SheetDbService } from './services/sheetDbService'; // Import SheetDbService

// Set limit for posts to scrape per community
const POST_LIMIT_PER_COMMUNITY = 20;

async function main() {
  const scraper = new SkoolScraper();
  const geminiService = new GeminiService();
  const sheetDbService = new SheetDbService(); // Instantiate SheetDbService
  
  try {
    // Environment variables are validated upon import of './env'
    console.log('Configuration validated (via env.ts)');
    
    // No Sheet initialization needed for SheetDB
    // console.log('Google Sheet initialized'); 
    
    // Initialize the browser (once)
    await scraper.initialize();
    console.log('Browser initialized');
    
    // Login to Skool (once)
    console.log('Attempting to log in to Skool...');
    const loginSuccess = await scraper.login();
    if (!loginSuccess) {
      throw new Error('Failed to log in to Skool. Check credentials and selectors.');
    }
    console.log('✅ Successfully logged in to Skool');

    // Loop through each community URL
    for (const communityUrl of SKOOL_COMMUNITY_URLS) {
      console.log(`\n--- Processing community: ${communityUrl} ---`);
      try {
        // Navigate to the community
        await scraper.navigateToCommunity(communityUrl);
        
        // Scrape posts for this community
        const posts = await scraper.scrapePosts(POST_LIMIT_PER_COMMUNITY);
        console.log(`Scraped ${posts.length} posts from ${communityUrl}`);
        
        if (posts.length === 0) {
          console.log('No posts found for this community. Skipping.');
          continue; // Move to the next community
        }
        
        // Process posts with Gemini AI
        console.log(`Processing ${posts.length} posts with Gemini AI...`);
        const processedPosts = await geminiService.processBatch(posts);
        console.log(`Processed ${processedPosts.length} posts with Gemini AI`);
        
        // Save processed posts to SheetDB
        console.log('Saving data to SheetDB...');
        await sheetDbService.saveToSheet(processedPosts); // Use SheetDbService
        
      } catch (communityError) {
        console.error(`❌ Failed to process community ${communityUrl}:`, communityError);
        // Continue to the next community even if one fails
      }
    }

    console.log('\n✅ Community scraping completed for all URLs.');

  } catch (error) {
    console.error('❌ An unrecoverable error occurred:', error);
    process.exitCode = 1; // Indicate failure
  } finally {
    // Ensure browser is closed even if errors occur
    await scraper.close();
    console.log('Browser closed.');
  }
}

// Run the main function
main(); 