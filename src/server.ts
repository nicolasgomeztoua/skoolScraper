import express, { Request, Response } from 'express';
import { z } from 'zod';
// Import both workflow functions
import { main as runScraperWorkflow, generatePostWorkflow } from './index';

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies (optional, but good practice)
app.use(express.json());

// Status flags for both workflows
let isScraping = false;
let isGenerating = false;

// Define the endpoint to trigger the scraper
// Using POST is generally better for actions that cause side effects
app.post('/trigger-scrape', (req: Request, res: Response): void => {
  console.log('Received request to trigger scrape...');

  // API Key check
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    console.warn('Attempted scrape trigger with missing or invalid API key.');
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  if (isScraping) {
    console.log('Scraping is already in progress. Ignoring new request.');
    res.status(409).json({ message: 'Scraping already in progress.' });
    return;
  }

  // Update response message
  res.status(202).json({ message: 'Scraping process accepted and started (using URLs from environment).' });

  isScraping = true;
  // Update logging message
  console.log('Starting the scraping process using URLs from environment...');
  // Call runScraper without arguments
  runScraperWorkflow()
    .then(() => {
      console.log('✅ Scraping process completed successfully.');
    })
    .catch((error) => {
      console.error('❌ Scraping process failed:', error);
    })
    .finally(() => {
      isScraping = false;
      console.log('Scraping status flag reset.');
    });
});

// NEW: Endpoint for generating posts
app.post('/generate-posts', (req: Request, res: Response): void => {
  console.log('Received request to trigger post generation...');

  // API Key check (reuse the same key for now)
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    console.warn('Attempted generation trigger with missing or invalid API key.');
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  // Check if generation is already running
  if (isGenerating) {
    console.log('Generation is already in progress. Ignoring new request.');
    res.status(409).json({ message: 'Generation already in progress.' });
    return;
  }
  
  // Check if scraping is running (optional: decide if they can run concurrently)
  if (isScraping) {
    console.log('Scraping is currently in progress. Please wait to trigger generation.');
    res.status(409).json({ message: 'Scraping is currently in progress. Cannot start generation.' });
    return;
  }

  // Respond immediately
  res.status(202).json({ message: 'Post generation process accepted and started.' });

  // Run the generation workflow asynchronously
  isGenerating = true;
  console.log('Starting the post generation workflow...');
  generatePostWorkflow()
    .then(() => console.log('✅ Post generation workflow completed successfully.'))
    .catch((error) => console.error('❌ Post generation workflow failed:', error))
    .finally(() => { isGenerating = false; console.log('Generation status flag reset.'); });
});

// Basic root endpoint for health check
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'Server running', 
    scrapingInProgress: isScraping, 
    generationInProgress: isGenerating 
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  console.log(`POST /trigger-scrape (X-API-Key)`);
  console.log(`POST /generate-posts (X-API-Key)`);
}); 