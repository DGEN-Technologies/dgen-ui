#!/usr/bin/env node

/**
 * Inject runtime configuration into the built app
 * This runs during Netlify build when env vars are unmasked
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Get environment variables during build time (when they're unmasked)
const runtimeConfig = {
  PUBLIC_SOCKET: process.env.PUBLIC_SOCKET || '',
  PUBLIC_DGEN_URL: process.env.PUBLIC_DGEN_URL || '',
  PUBLIC_DOMAIN: process.env.PUBLIC_DOMAIN || '',
  PUBLIC_EXPLORER: process.env.PUBLIC_EXPLORER || '',
  PUBLIC_LIQUID_EXPLORER: process.env.PUBLIC_LIQUID_EXPLORER || '',
  PUBLIC_BTC: process.env.PUBLIC_BTC || '',
  PUBLIC_DGEN_PUBKEY: process.env.PUBLIC_DGEN_PUBKEY || '',
  PUBLIC_DGEN_RELAY: process.env.PUBLIC_DGEN_RELAY || '',
  PUBLIC_VAPID_PUBKEY: process.env.PUBLIC_VAPID_PUBKEY || '',
  PUBLIC_RECAPTCHA_SITE_KEY: process.env.PUBLIC_RECAPTCHA_SITE_KEY || '',
  PUBLIC_DGEN_NETWORK: process.env.PUBLIC_DGEN_NETWORK || 'mainnet'
};

// Create runtime config script
const configScript = `
<script>
  // Runtime configuration injected at build time
  window.__RUNTIME_CONFIG__ = ${JSON.stringify(runtimeConfig)};
</script>
`;

// Create a runtime config JS file that can be imported
const configFilePath = path.join(__dirname, '..', 'build', '_app', 'immutable', 'chunks', 'runtime-config.js');

// Ensure directory exists
const configDir = path.dirname(configFilePath);
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

// Write runtime config as a JS module
const configContent = `// Runtime configuration injected at build time
export const RUNTIME_CONFIG = ${JSON.stringify(runtimeConfig, null, 2)};

// Also set on window for backward compatibility
if (typeof window !== 'undefined') {
  window.__RUNTIME_CONFIG__ = RUNTIME_CONFIG;
}
`;

fs.writeFileSync(configFilePath, configContent);
console.log('✅ Runtime configuration injected as JS module');

// Inject into index.html
const indexPath = path.join(__dirname, '..', 'build', 'index.html');
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf-8');
  
  // Create script tag with runtime config
  const scriptTag = `<script>window.__RUNTIME_CONFIG__=${JSON.stringify(runtimeConfig)};</script>`;
  
  // Inject before closing head tag or body tag
  if (html.includes('</head>')) {
    html = html.replace('</head>', `${scriptTag}\n</head>`);
  } else if (html.includes('<body>')) {
    html = html.replace('<body>', `<body>\n${scriptTag}`);
  }
  
  fs.writeFileSync(indexPath, html);
  console.log('✅ Runtime configuration injected into index.html');
}

// Also create a static HTML snippet for Netlify's edge functions
const snippetPath = path.join(__dirname, '..', 'build', '_headers');
if (fs.existsSync(snippetPath)) {
  let headers = fs.readFileSync(snippetPath, 'utf-8');
  
  // Add inline script header for runtime config
  const configHeader = `/*
  Content-Security-Policy: script-src 'self' 'unsafe-inline' https: wss:; object-src 'none'
  X-Runtime-Config: ${Buffer.from(JSON.stringify(runtimeConfig)).toString('base64')}`;
  
  if (!headers.includes('X-Runtime-Config')) {
    fs.writeFileSync(snippetPath, configHeader + '\n\n' + headers);
    console.log('✅ Runtime configuration added to _headers');
  }
}

console.log('Injected config:', {
  ...runtimeConfig,
  // Mask sensitive values in logs
  PUBLIC_SOCKET: runtimeConfig.PUBLIC_SOCKET ? '***' : 'not set',
  PUBLIC_DGEN_URL: runtimeConfig.PUBLIC_DGEN_URL ? '***' : 'not set'
});