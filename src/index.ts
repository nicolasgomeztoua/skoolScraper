import './env'; // Import to initialize and validate env vars early
// Re-import SKOOL_COMMUNITY_URLS from config
import { SKOOL_COMMUNITY_URLS } from './config';
import { SkoolScraper } from './services/skoolScraper';
import { GeminiService } from './services/geminiService';
import { SheetDbService } from './services/sheetDbService'; // Import SheetDbService

// Set limit for posts to scrape per community
const POST_LIMIT_PER_COMMUNITY = 20;
const STATUS_COLUMN_INDEX = 6; // Index of 'status' in REQUIRED_HEADERS (0-based)
const ID_COLUMN_INDEX = 0; // Index of 'id'
const CONTENT_COLUMN_INDEX = 2; // Index of 'originalContent'

// Workflow for scraping and analyzing posts
export async function main() {
  // Remove check for empty URLs parameter
  console.log('Starting scraping process based on URLs from environment variables.');

  const scraper = new SkoolScraper();
  const geminiService = new GeminiService();
  const sheetDbService = new SheetDbService();
  
  try {
    console.log('Configuration validated (via env.ts)');
    
    // Initialize browser and login once
    await scraper.initialize();
    console.log('Browser initialized');
    console.log('Attempting to log in to Skool...');
    const loginSuccess = await scraper.login();
    if (!loginSuccess) {
      throw new Error('Failed to log in to Skool. Check credentials and selectors.');
    }
    console.log('✅ Successfully logged in to Skool');

    // Loop through each community URL from config
    for (const communityUrl of SKOOL_COMMUNITY_URLS) {
      // Extract community name for sheet name (simple extraction, might need refinement)
      const communityName = communityUrl.substring(communityUrl.lastIndexOf('/') + 1);
      console.log(`\n--- Processing community: ${communityUrl} (Sheet: ${communityName}) ---`);

      try {
        // Fetch existing IDs *for this specific sheet* inside the loop
        const existingPostIds = await sheetDbService.getExistingPostIds(communityName);
        console.log(`Fetched ${existingPostIds.size} existing post IDs from sheet '${communityName}'.`);

        // Navigate to the community
        await scraper.navigateToCommunity(communityUrl);
        
        // Scrape posts
        const scrapedPosts = await scraper.scrapePosts(POST_LIMIT_PER_COMMUNITY);
        console.log(`Scraped ${scrapedPosts.length} posts from ${communityUrl}`);
        
        if (scrapedPosts.length === 0) {
          console.log('No posts found. Skipping.');
          continue;
        }
        
        // Filter out duplicates based on IDs from the *current sheet*
        const newPosts = scrapedPosts.filter(post => !existingPostIds.has(post.id));
        const duplicateCount = scrapedPosts.length - newPosts.length;
        console.log(`Found ${duplicateCount} duplicate posts. Processing ${newPosts.length} new posts.`);

        if (newPosts.length === 0) {
          console.log('No new posts found. Skipping processing and saving.');
          continue;
        }
        
        // Process new posts
        console.log(`Processing ${newPosts.length} posts with Gemini AI...`);
        const processedPosts = await geminiService.processBatch(newPosts);
        console.log(`Processed ${processedPosts.length} posts.`);
        
        // Save processed posts to the specific sheet
        console.log(`Saving ${processedPosts.length} posts to sheet '${communityName}'...`);
        await sheetDbService.saveToSheet(processedPosts, communityName);
        
      } catch (communityError) {
        console.error(`❌ Failed to process community ${communityUrl}:`, communityError);
      }
    }

    console.log('\n✅ Community scraping completed for all URLs.');

  } catch (error) {
    console.error('❌ An unrecoverable error occurred:', error);
    process.exitCode = 1;
  } finally {
    await scraper.close();
    console.log('Browser closed.');
  }
}

// NEW: Workflow for generating posts
export async function generatePostWorkflow() {
  console.log("\n🚀 Starting Generate Post Workflow...");
  const geminiService = new GeminiService();
  const sheetDbService = new SheetDbService();
  // No scraper needed for this workflow

  try {
    console.log('Configuration validated (via env.ts)');

    // Loop through each community configured
    for (const communityUrl of SKOOL_COMMUNITY_URLS) {
      const communityName = communityUrl.substring(communityUrl.lastIndexOf('/') + 1);
      console.log(`\n--- Processing generation for community: ${communityUrl} (Sheet: ${communityName}) ---`);

      try {
        // 1. Fetch all data from the original community sheet
        const allPostsData = await sheetDbService.getSheetData(communityName);
        if (allPostsData.length === 0) {
          console.log(`Sheet '${communityName}' is empty or could not be read. Skipping generation.`);
          continue;
        }

        // 2. Filter for unprocessed posts (status === 'New')
        const unprocessedPosts = allPostsData.filter(row => row[STATUS_COLUMN_INDEX] === 'New');
        console.log(`Found ${unprocessedPosts.length} posts with status 'New' in sheet '${communityName}'.`);

        if (unprocessedPosts.length === 0) {
          console.log('No unprocessed posts found for this community. Skipping generation.');
          continue;
        }

        // 3. Select one post to generate from
        const selectedPostId = await geminiService.selectPostForGeneration(unprocessedPosts);

        if (!selectedPostId) {
          console.log('AI (or basic logic) did not select a post for generation. Skipping.');
          // Optional: Update status of all unprocessed to 'Not Eligible' here?
          continue;
        }

        // Find the full data row for the selected post
        const selectedPostData = unprocessedPosts.find(row => row[ID_COLUMN_INDEX] === selectedPostId);
        if (!selectedPostData) {
            console.error(`Error: Selected Post ID '${selectedPostId}' not found in unprocessed data. This shouldn't happen.`);
            continue;
        }

        // 4. Generate the new post content
        console.log(`Generating new post content based on selected post ID: ${selectedPostId}`);
        const generatedContent = await geminiService.generatePostFromSource(selectedPostData);

        if (!generatedContent) {
            console.warn(`AI failed to generate content for post ID '${selectedPostId}'. Skipping save and status update.`);
             // Optional: Update status to 'Generation Failed'?
            continue;
        }

        // 5. Prepare data row for the generated posts sheet
        const generatedSheetName = `posts-${communityName}`;
        // Headers: ['originalPostId', 'originalContentSnippet', 'generatedTitle', 'generatedContent', 'generationTimestamp', 'status']
        const generatedPostRow = [
            selectedPostId,
            (selectedPostData[CONTENT_COLUMN_INDEX] || '').substring(0, 300) + '...', // Snippet
            '', // TODO: Generate title? For now, empty.
            generatedContent,
            new Date().toISOString(),
            'Draft' // Initial status for generated post
        ];

        // 6. Save the generated post to the new sheet
        // We need to wrap the single row in another array for saveToSheet
        console.log(`Saving generated post to sheet '${generatedSheetName}'...`);
        // Use a generic type for saveToSheet or adapt mapPostToRowArray
        // For now, casting to any to bypass strict type checking for the single row.
        // A dedicated function or type check would be better.
        await sheetDbService.saveToSheet([generatedPostRow] as any, generatedSheetName);

        // 7. Mark the original post as 'Processed'
        console.log(`Updating status of original post ID '${selectedPostId}' to 'Processed' in sheet '${communityName}'...`);
        await sheetDbService.updatePostStatus(communityName, selectedPostId, 'Processed');

      } catch (communityGenError) {
        console.error(`❌ Failed to process generation for community ${communityUrl}:`, communityGenError);
        // Continue to the next community
      }
    }

    console.log('\n✅ Post generation workflow completed for all URLs.');

  } catch (error) {
    console.error('❌ An unrecoverable error occurred during generation workflow:', error);
    process.exitCode = 1;
  }
  // No browser to close in this workflow
}

// Remove the direct call to main() - it's called by server now
// main(); 