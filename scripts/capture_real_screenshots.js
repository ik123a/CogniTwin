const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('Starting Puppeteer browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // 1. Desktop Viewport
  await page.setViewport({ width: 1280, height: 800 });

  // Dynamically check ports 5173 and 5174
  let url = 'http://localhost:5173';
  console.log('Detecting active dev server port...');
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 5000 });
  } catch (e) {
    console.log('Port 5173 not responding, trying port 5174...');
    url = 'http://localhost:5174';
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
    } catch (err) {
      console.error('Neither port 5173 nor 5174 responded. Exiting.', err);
      await browser.close();
      process.exit(1);
    }
  }

  console.log(`Connected to dev server at ${url}`);
  await new Promise(r => setTimeout(r, 2000));

  // Check login screen mode
  const isRegisterMode = await page.evaluate(() => {
    return !!document.querySelector('input[placeholder="Enter your name"]');
  });

  if (isRegisterMode) {
    console.log('Registering default user...');
    await page.type('input[placeholder="Enter your name"]', 'Admin User');
    await page.type('input[placeholder="Choose a strong password"]', 'password123');
    await page.type('input[placeholder="Confirm password"]', 'password123');
    await page.click('button[type="submit"]');
  } else {
    console.log('Logging in...');
    await page.type('input[placeholder="Enter master password"]', 'password123');
    await page.click('button[type="submit"]');
  }

  console.log('Waiting 6 seconds for login/register transition...');
  await new Promise(r => setTimeout(r, 6000));

  // Bypass onboarding if active
  const hasSidebar = await page.evaluate(() => !!document.querySelector('.app-sidebar'));
  if (!hasSidebar) {
    console.log('Onboarding Wizard detected. Bypassing steps...');
    for (let i = 0; i < 6; i++) {
      const clicked = await page.evaluate(() => {
        const btn = document.querySelector('button.btn-primary');
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });
      if (!clicked) break;
      console.log(`Clicked Onboarding step ${i + 1}`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log('Waiting for final main dashboard stability...');
  await new Promise(r => setTimeout(r, 4000));

  // Take Dashboard Screenshot
  console.log('Capturing Dashboard screenshot...');
  const screenshotDir = 'c:/Users/SKV/Desktop/Projects/CogniTwin/resources/screenshots';
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
  await page.screenshot({ path: path.join(screenshotDir, 'cognitwin_dashboard.png') });

  // Navigate to Twin Simulation
  console.log('Navigating to Twin Simulation page...');
  const clickedSim = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.sidebar-item'));
    const simItem = items.find(el => el.textContent.includes('Twin Simulation'));
    if (simItem) {
      simItem.click();
      return true;
    }
    return false;
  });

  if (clickedSim) {
    console.log('Waiting for Twin Simulation charts...');
    await new Promise(r => setTimeout(r, 5000));
    await page.screenshot({ path: path.join(screenshotDir, 'cognitwin_simulation.png') });
  }

  // Navigate to Workspace
  console.log('Navigating to Workspace page...');
  const clickedWorkspace = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.sidebar-item'));
    const wsItem = items.find(el => el.textContent.includes('Workspace'));
    if (wsItem) {
      wsItem.click();
      return true;
    }
    return false;
  });

  if (clickedWorkspace) {
    console.log('Waiting for Workspace to render...');
    await new Promise(r => setTimeout(r, 4000));
    await page.screenshot({ path: path.join(screenshotDir, 'cognitwin_workspace.png') });
  }

  // 2. Mobile Viewport Screenshot
  console.log('Simulating mobile layout...');
  await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
  
  await page.evaluate(() => {
    localStorage.clear();
    window.location.reload();
  });
  
  await new Promise(r => setTimeout(r, 4000));

  console.log('Opening IP configuration panel...');
  const clickedIpConfig = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    const ipLink = links.find(el => el.textContent.includes('Configure Server IP'));
    if (ipLink) {
      ipLink.click();
      return true;
    }
    return false;
  });

  if (clickedIpConfig) {
    await new Promise(r => setTimeout(r, 1500));
    console.log('Capturing mobile screenshot...');
    await page.screenshot({ path: path.join(screenshotDir, 'cognitwin_mobile.png') });
  }

  console.log('All screenshots captured successfully.');
  await browser.close();
  process.exit(0);
})().catch(err => {
  console.error('Unhandled error in script:', err);
  process.exit(1);
});
