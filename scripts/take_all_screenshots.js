const { spawn, execSync } = require('child_process');
const http = require('http');

console.log('Spawning dev server in background...');
const devProcess = spawn('npm', ['run', 'dev'], {
  cwd: 'c:/Users/SKV/Desktop/Projects/CogniTwin',
  shell: true,
  stdio: 'inherit'
});

// Clean exit handlers to kill subprocess
const cleanExit = () => {
  console.log('Stopping dev server process...');
  if (process.platform === 'win32') {
    try {
      execSync('taskkill /pid ' + devProcess.pid + ' /T /F');
    } catch (e) {}
  } else {
    devProcess.kill();
  }
};

process.on('SIGINT', () => { cleanExit(); process.exit(1); });
process.on('SIGTERM', () => { cleanExit(); process.exit(1); });

// Poll helper that checks both ports
const checkPort = (port) => {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
  });
};

const pollPorts = async (retries = 30) => {
  for (let i = 1; i <= retries; i++) {
    console.log(`Polling dev server ports 5173/5174 (Attempt ${i}/${retries})...`);
    const up5173 = await checkPort(5173);
    const up5174 = await checkPort(5174);
    if (up5173 || up5174) {
      console.log(`Dev server detected up! (5173: ${up5173}, 5174: ${up5174})`);
      return;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('Vite dev server timed out starting up.');
};

(async () => {
  try {
    // Wait for Vite
    await pollPorts();
    
    // Give backend server a moment to finish starting database migrations
    await new Promise(r => setTimeout(r, 4000));

    console.log('Running Puppeteer screenshot capture...');
    execSync('node scripts/capture_real_screenshots.js', {
      cwd: 'c:/Users/SKV/Desktop/Projects/CogniTwin',
      stdio: 'inherit'
    });

    console.log('All screenshots captured successfully.');
  } catch (err) {
    console.error('Error occurred in screenshot pipeline:', err);
  } finally {
    cleanExit();
    process.exit(0);
  }
})();
