#!/usr/bin/env node

/**
 * Development Build Script for Fretiko Mobile
 * Handles EAS build with automatic credential generation
 */

const { spawn } = require('child_process');

console.log('🚀 Starting Fretiko Mobile Development Build...');

// Build command with automatic credential handling
const buildProcess = spawn('eas', [
  'build',
  '--platform', 'android',
  '--profile', 'development',
  '--auto-submit', 'false'
], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    EAS_NO_INTERACTIVE: '1'  // Disable interactive prompts
  }
});

buildProcess.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Build completed successfully!');
    console.log('📱 Download your APK from: https://expo.dev/builds');
  } else {
    console.log('❌ Build failed with exit code:', code);
    console.log('💡 Try running: eas build --platform android --profile development --clear-cache');
  }
});

buildProcess.on('error', (err) => {
  console.error('❌ Build process error:', err);
});