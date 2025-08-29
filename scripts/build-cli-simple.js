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

// Create a Node.js executable wrapper that uses ts-node
const wrapperScript = `#!/usr/bin/env node

// This is the killall CLI bundled with the Electron app
// It uses the Electron app's database and configuration

const path = require('path');
const { spawn } = require('child_process');

// Find ts-node - it should be in the app's node_modules
const appResourcePath = path.dirname(__dirname);
const tsNodePath = path.join(appResourcePath, 'node_modules', '.bin', 'ts-node');
const cliEntryPoint = path.join(__dirname, 'src', 'index.ts');

// Check if we're in development or production
const isDev = !__dirname.includes('app.asar');

if (isDev || !require('fs').existsSync(tsNodePath)) {
  // Fallback to using regular node with require hooks
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
} else {
  // Use ts-node from the bundled app
  const child = spawn(tsNodePath, [cliEntryPoint, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: {
      ...process.env,
      TS_NODE_TRANSPILE_ONLY: 'true'
    }
  });
  
  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}
`;

// Write the wrapper script
fs.writeFileSync(path.join(cliDistPath, 'killall'), wrapperScript);
fs.chmodSync(path.join(cliDistPath, 'killall'), '755');

// Create a package.json for the CLI
const cliPackageJson = {
  name: 'killall-cli',
  version: '1.0.0',
  description: 'Killall-Tofu CLI',
  main: 'src/index.ts',
  dependencies: {
    'commander': '^12.0.0',
    'js-yaml': '^4.1.0',
    'uuid': '^10.0.0'
  }
};

fs.writeFileSync(
  path.join(cliDistPath, 'package.json'), 
  JSON.stringify(cliPackageJson, null, 2)
);

console.log('CLI preparation complete!');