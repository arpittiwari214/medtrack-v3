/**
 * Metro configuration for a monorepo.
 *
 * Two adjustments are needed, both because `@medtrack/shared` lives outside
 * this package:
 *
 *  1. `watchFolders` must include the repo root, or Metro will not see changes
 *     to the shared package and will fail to resolve it at all.
 *  2. `nodeModulesPaths` must list both the local and the hoisted
 *     `node_modules`, since npm workspaces hoist most dependencies to the root
 *     while a few stay local.
 *
 * `disableHierarchicalLookup` is left off deliberately: turning it on is the
 * common advice for pnpm, but with npm's hoisting it causes React Native's own
 * transitive dependencies to go missing.
 */

const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
