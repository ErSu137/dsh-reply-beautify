// Runs only the installation-owned CLI with the installation-owned package manager.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const installation = path.dirname(process.execPath);
const resources = path.join(installation, 'resources');
const nodeBin = path.join(resources, 'runtime', 'bin');
const pnpm = path.join(resources, 'runtime', 'primary-runtime', 'dependencies', 'pnpm', 'bin', 'pnpm.mjs');
const entry = path.join(resources, 'app.asar', 'dsh', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');
const { runCli } = await import(pathToFileURL(entry).href);
await runCli({ manageDesktopProfile: true, packageManager: {
  command: process.execPath, args: [pnpm],
  env: { ELECTRON_RUN_AS_NODE: '1', PATH: nodeBin + path.delimiter + process.env.PATH }
} });
