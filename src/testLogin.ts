import dotenv from 'dotenv';
import puppeteer from 'puppeteer';

// Load environment variables
dotenv.config();

const skoolEmail = process.env.SKOOL_EMAIL || '';
const skoolPassword = process.env.SKOOL_PASSWORD || '';

async function testSkoolLogin() {
  if (!skoolEmail || !skoolPassword) {
    console.error('Missing SKOOL_EMAIL or SKOOL_PASSWORD environment variables');
    process.exit(1);
  }

  console.log('Testing Skool login...');
  console.log(`Using email: ${skoolEmail.substring(0, 3)}***${skoolEmail.split('@')[1]}`);
  
  const browser = await puppeteer.launch({
    headless: false, // Use non-headless mode so you can see what's happening
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });
    
    // Navigate to login page
    console.log('Navigating to Skool login page...');
    await page.goto('https://www.skool.com/login', { waitUntil: 'networkidle2' });
    
    // Fill in login form
    console.log('Filling login form...');
    await page.type('input[type="email"]', skoolEmail);
    await page.type('input[type="password"]', skoolPassword);
    
    // Click login button and wait for navigation
    console.log('Submitting login...');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
    ]);
    
    // Check if login was successful
    const url = page.url();
    const loginSuccess = !url.includes('/login');
    
    if (loginSuccess) {
      console.log('✅ Login successful!');
      console.log(`Current URL: ${url}`);
      
      // Wait a bit to see the logged-in state
      await new Promise(resolve => setTimeout(resolve, 5000));
    } else {
      console.error('❌ Login failed!');
      console.error(`Current URL: ${url}`);
    }

    return loginSuccess;
  } catch (error) {
    console.error('Error during login test:', error);
    return false;
  } finally {
    await browser.close();
  }
}

// Run the test
testSkoolLogin().then(success => {
  if (!success) {
    process.exit(1);
  }
}); 