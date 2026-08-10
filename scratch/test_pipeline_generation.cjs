const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function testPipeline() {
  console.log('Building bundle to test engine output...');
  // Run tsc check
  execSync('npx tsc --noEmit', { stdio: 'inherit' });
  console.log('TypeScript check passed 0 errors.');
}

testPipeline().catch(console.error);
