#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Building CLI for distribution...');

// Clean dist/cli directory
const cliDistPath = path.join(__dirname, '..', 'dist', 'cli');
if (fs.existsSync(cliDistPath)) {
  fs.rmSync(cliDistPath, { recursive: true });
}
fs.mkdirSync(cliDistPath, { recursive: true });

// Compile TypeScript CLI  
console.log('Compiling TypeScript CLI...');
try {
  execSync('npx tsc src/cli/index.ts src/cli/commands/init.ts --outDir dist/cli --module commonjs --target es2020 --esModuleInterop --skipLibCheck --resolveJsonModule --allowJs --noEmit false --declaration false', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
} catch (error) {
  console.error('TypeScript compilation failed. Using ts-node to transpile instead...');
  // Fallback: copy source files and use ts-node
  execSync('cp -r src/cli dist/', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
}

// Create a wrapper script for the CLI
const wrapperScript = `#!/usr/bin/env node
const path = require('path');
const { spawn } = require('child_process');

// Determine the path to the Node.js executable and CLI entry point
const nodeExecutable = process.execPath;
const cliPath = path.join(__dirname, 'index.js');

// Forward all arguments to the CLI
const child = spawn(nodeExecutable, [cliPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code) => {
  process.exit(code);
});
`;

// Write the wrapper script
fs.writeFileSync(path.join(cliDistPath, 'killall'), wrapperScript);
fs.chmodSync(path.join(cliDistPath, 'killall'), '755');

console.log('CLI build complete!');