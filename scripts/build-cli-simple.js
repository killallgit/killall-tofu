#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('Preparing CLI for distribution...');

// Clean dist/cli directory
const cliDistPath = path.join(__dirname, '..', 'dist', 'cli');
if (fs.existsSync(cliDistPath)) {
  fs.rmSync(cliDistPath, { recursive: true });
}
fs.mkdirSync(cliDistPath, { recursive: true });

// Copy the CLI TypeScript source files
console.log('Copying CLI source files...');
const srcCliPath = path.join(__dirname, '..', 'src', 'cli');
fs.cpSync(srcCliPath, path.join(cliDistPath, 'src'), { recursive: true });

// Create a Node.js executable wrapper that uses ts-node with error handling
const wrapperScript = `#!/usr/bin/env node

// This is the killall CLI bundled with the Electron app
// It uses the Electron app's database and configuration

const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

try {
  // Find ts-node - it should be in the app's node_modules
  const appResourcePath = path.dirname(__dirname);
  const tsNodePath = path.join(appResourcePath, 'node_modules', '.bin', 'ts-node');
  const cliEntryPoint = path.join(__dirname, 'src', 'index.ts');

  // Validate entry point exists
  if (!fs.existsSync(cliEntryPoint)) {
    console.error('Error: CLI entry point not found at', cliEntryPoint);
    process.exit(1);
  }

  // Check if we're in development or production
  const isDev = !__dirname.includes('app.asar');

  if (isDev || !fs.existsSync(tsNodePath)) {
    // Fallback to using regular node with require hooks
    try {
      require('ts-node').register({
        transpileOnly: true,
        compilerOptions: {
          module: 'commonjs',
          target: 'es2020',
          esModuleInterop: true,
          skipLibCheck: true
        }
      });
      require(cliEntryPoint);
    } catch (error) {
      console.error('Error loading CLI with ts-node:', error.message);
      console.error('Please ensure ts-node is installed and the Electron app is properly built.');
      process.exit(1);
    }
  } else {
    // Use ts-node from the bundled app
    const child = spawn(tsNodePath, [cliEntryPoint, ...process.argv.slice(2)], {
      stdio: 'inherit',
      env: {
        ...process.env,
        TS_NODE_TRANSPILE_ONLY: 'true'
      }
    });
    
    child.on('error', (error) => {
      console.error('Error spawning CLI process:', error.message);
      process.exit(1);
    });
    
    child.on('exit', (code, signal) => {
      if (signal) {
        console.error('CLI process terminated by signal:', signal);
        process.exit(1);
      }
      process.exit(code || 0);
    });
  }
} catch (error) {
  console.error('Fatal error in CLI wrapper:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}
`;

// Write the wrapper script
fs.writeFileSync(path.join(cliDistPath, 'killall'), wrapperScript);
fs.chmodSync(path.join(cliDistPath, 'killall'), '755');

// Create a package.json for the CLI (match main app versions)
const cliPackageJson = {
  name: 'killall-cli',
  version: '1.0.0',
  description: 'Killall-Tofu CLI',
  main: 'src/index.ts',
  dependencies: {
    'commander': '^14.0.0',
    'js-yaml': '^4.1.0'
    // uuid removed as it's no longer used
  }
};

fs.writeFileSync(
  path.join(cliDistPath, 'package.json'), 
  JSON.stringify(cliPackageJson, null, 2)
);

console.log('CLI preparation complete!');
