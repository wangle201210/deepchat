#!/usr/bin/env node

/**
 * Update pnpm-workspace.yaml supportedArchitectures for different platforms
 * 根据不同平台动态修改 pnpm-workspace.yaml 的 supportedArchitectures 配置
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { platform, arch } from 'os';

// Get platform info from environment or system
const targetOS = process.env.TARGET_OS || process.env.npm_config_os || platform();
const targetArch = process.env.TARGET_ARCH || process.env.npm_config_arch || arch();

console.log(`🎯 Configuring pnpm workspace for platform: ${targetOS}-${targetArch}`);

// Define platform-specific configurations
const platformConfigs = {
  'win32-x64': {
    os: ['current', 'win32'],
    cpu: ['current', 'x64']
  },
  'win32-arm64': {
    os: ['current', 'win32'],
    cpu: ['current', 'arm64']
  },
  'linux-x64': {
    os: ['current', 'linux'],
    cpu: ['current', 'wasm32'], // Include wasm32 for Sharp WebAssembly
  },
  'linux-arm64': {
    os: ['linux'],
    cpu: ['current', 'wasm32'],
  },
  'darwin-x64': {
    os: ['current', 'darwin'],
    cpu: ['current', 'x64'],
  },
  'darwin-arm64': {
    os: ['current', 'darwin'],
    cpu: ['current', 'arm64'],
  }
};

const platformKey = `${targetOS}-${targetArch}`;
const config = platformConfigs[platformKey];

if (!config) {
  console.warn(`⚠️  No specific configuration for ${platformKey}, using default`);
  console.log(`📝 Keeping existing pnpm-workspace.yaml configuration`);
  process.exit(0);
}

const workspaceFile = 'pnpm-workspace.yaml';

try {
  let existingContent = '';
  let otherConfigurations = [];

  // Read existing file if it exists
  if (existsSync(workspaceFile)) {
    existingContent = readFileSync(workspaceFile, 'utf8');

    // Parse existing content to extract non-supportedArchitectures configurations
    const lines = existingContent.split('\n');
    let inSupportedArchitectures = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('supportedArchitectures:')) {
        inSupportedArchitectures = true;
        continue;
      }

      if (inSupportedArchitectures) {
        // Check if we've reached a new top-level configuration
        if (trimmed && !line.startsWith('  ') && !trimmed.startsWith('-')) {
          inSupportedArchitectures = false;
          otherConfigurations.push(line);
        }
        // Skip lines that are part of supportedArchitectures
      } else if (trimmed) {
        // This is a non-supportedArchitectures configuration
        otherConfigurations.push(line);
      } else if (otherConfigurations.length > 0) {
        // Keep empty lines between configurations
        otherConfigurations.push(line);
      }
    }
  }
  // Generate supportedArchitectures section
  const supportedArchitecturesSection = `supportedArchitectures:
  os:
${config.os.map(os => `    - ${os}`).join('\n')}
  cpu:
${config.cpu.map(cpu => `    - ${cpu}`).join('\n')}`;

  let finalContent;

  if (otherConfigurations.length > 0) {
    // If there are other configurations, preserve them
    console.log(`📝 Updating supportedArchitectures while preserving other configurations`);
    const otherContent = otherConfigurations.join('\n').trim();
    finalContent = supportedArchitecturesSection + '\n\n' + otherContent + '\n';
  } else {
    // If no other configurations, just write the supportedArchitectures section
    finalContent = supportedArchitecturesSection + '\n';
  }

  writeFileSync(workspaceFile, finalContent, 'utf8');
  console.log(`✅ Updated pnpm-workspace.yaml for ${platformKey}`);
  console.log(`📋 Configuration:`);
  console.log(`   OS: ${config.os.join(', ')}`);
  console.log(`   CPU: ${config.cpu.join(', ')}`);
} catch (error) {
  console.error(`❌ Failed to update pnpm-workspace.yaml: ${error.message}`);
  process.exit(1);
}

console.log(`🎉 Platform configuration completed. Run 'pnpm install' to install dependencies.`);
