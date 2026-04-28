#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// wp-plugins.js — Manage WordPress plugin activation states
//
// Targets the site in .wp-credentials (currently staging6.jlmwines.com)
// via WP REST API + application password. No SFTP/SSH required.
//
// Usage:
//   node website/wp-plugins.js list                  # show all plugins + state
//   node website/wp-plugins.js snapshot [out.json]   # save current state
//                                                    # default: website/staging-plugin-baseline.json
//   node website/wp-plugins.js apply [baseline.json] # converge live state to baseline
//   node website/wp-plugins.js activate <plugin>     # activate one
//   node website/wp-plugins.js deactivate <plugin>   # deactivate one
//
// Plugin slug format: folder/main-file (e.g. woocommerce/woocommerce).
// Run `list` first to see the exact slugs the server uses.
// ═══════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CRED_PATH = path.join(PROJECT_ROOT, '.wp-credentials');
const BASELINE_DEFAULT = path.join(__dirname, 'staging-plugin-baseline.json');

function fail(msg) { console.error('Error: ' + msg); process.exit(1); }

async function listPlugins(wp) {
  const res = await wp.api('GET', '/wp-json/wp/v2/plugins');
  if (res.status !== 200) {
    fail('Failed to list plugins (' + res.status + '): ' + JSON.stringify(res.data).substring(0, 300));
  }
  return res.data;
}

async function setStatus(wp, plugin, status) {
  // Plugin slug contains a literal slash; WP route accepts it as-is.
  return wp.api('POST', '/wp-json/wp/v2/plugins/' + plugin, { status: status });
}

function marker(status) {
  if (status === 'active') return '+';
  if (status === 'network-active') return '*';
  return '-';
}

async function cmdList(wp) {
  const plugins = await listPlugins(wp);
  plugins.sort(function (a, b) { return (a.plugin || '').localeCompare(b.plugin || ''); });
  console.log(plugins.length + ' plugins on ' + wp.hostname + ':\n');
  plugins.forEach(function (p) {
    const name = (p.name || '(no name)').replace(/<[^>]+>/g, '');
    console.log('  ' + marker(p.status) + ' ' + (p.plugin || '').padEnd(50) + '  ' + p.status.padEnd(15) + '  ' + name);
  });
  console.log('\n+ active   - inactive   * network-active');
}

async function cmdSnapshot(wp, outPath) {
  const plugins = await listPlugins(wp);
  plugins.sort(function (a, b) { return (a.plugin || '').localeCompare(b.plugin || ''); });
  const out = {
    description: 'Staging6 plugin baseline — captured ' + new Date().toISOString().slice(0, 10) +
      '. Run `node website/wp-plugins.js apply` after a SiteGround staging refresh to restore.',
    site_url: 'https://' + wp.hostname,
    plugins: {}
  };
  plugins.forEach(function (p) {
    out.plugins[p.plugin] = p.status;
  });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
  console.log('Snapshot saved to ' + path.relative(PROJECT_ROOT, outPath));
  console.log(plugins.length + ' plugins recorded.');
}

async function cmdApply(wp, baselinePath) {
  if (!fs.existsSync(baselinePath)) fail('Baseline not found: ' + baselinePath);
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  if (!baseline.plugins) fail('Baseline JSON missing "plugins" key');

  const live = await listPlugins(wp);
  const liveMap = {};
  live.forEach(function (p) { liveMap[p.plugin] = p.status; });

  console.log('Applying ' + path.relative(PROJECT_ROOT, baselinePath) + ' to ' + wp.hostname + '\n');

  let changed = 0, skipped = 0, missing = 0, failed = 0;

  for (const plugin of Object.keys(baseline.plugins)) {
    const desired = baseline.plugins[plugin];
    const actual = liveMap[plugin];

    if (actual === undefined) {
      console.log('  ? ' + plugin.padEnd(50) + '  not installed — skip');
      missing++;
      continue;
    }
    if (actual === desired) {
      console.log('  = ' + plugin.padEnd(50) + '  already ' + desired);
      skipped++;
      continue;
    }

    process.stdout.write('  ' + marker(desired) + ' ' + plugin.padEnd(50) + '  ' + actual + ' -> ' + desired);
    const res = await setStatus(wp, plugin, desired);
    if (res.status === 200) {
      console.log('  OK');
      changed++;
    } else {
      console.log('  FAILED (' + res.status + ')');
      failed++;
    }
  }

  const orphans = live.filter(function (p) { return !(p.plugin in baseline.plugins); });
  if (orphans.length > 0) {
    console.log('\nInstalled but not in baseline (left untouched):');
    orphans.forEach(function (p) {
      console.log('  ? ' + (p.plugin || '').padEnd(50) + '  ' + p.status);
    });
  }

  console.log('\n' + changed + ' changed · ' + skipped + ' already correct · ' + missing + ' missing · ' + failed + ' failed · ' + orphans.length + ' orphan');
  if (failed > 0) process.exit(1);
}

async function cmdSet(wp, plugin, status) {
  const res = await setStatus(wp, plugin, status);
  if (res.status === 200) {
    console.log('OK: ' + plugin + ' -> ' + status);
  } else {
    console.log('FAILED (' + res.status + '): ' + JSON.stringify(res.data).substring(0, 300));
    process.exit(1);
  }
}

function printHelp() {
  console.log('Usage:');
  console.log('  node website/wp-plugins.js list                  # show all plugins + state');
  console.log('  node website/wp-plugins.js snapshot [out.json]   # save current state to JSON');
  console.log('  node website/wp-plugins.js apply [baseline.json] # converge live to baseline');
  console.log('  node website/wp-plugins.js activate <plugin>     # activate one');
  console.log('  node website/wp-plugins.js deactivate <plugin>   # deactivate one');
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === 'help' || cmd === '-h' || cmd === '--help') {
    printHelp();
    return;
  }

  if (!fs.existsSync(CRED_PATH)) fail('.wp-credentials not found at ' + CRED_PATH);
  const wp = require('../../tools/wp-api')(CRED_PATH);

  switch (cmd) {
    case 'list':
      await cmdList(wp);
      break;
    case 'snapshot':
      await cmdSnapshot(wp, args[1] ? path.resolve(args[1]) : BASELINE_DEFAULT);
      break;
    case 'apply':
      await cmdApply(wp, args[1] ? path.resolve(args[1]) : BASELINE_DEFAULT);
      break;
    case 'activate':
      if (!args[1]) fail('Plugin slug required (e.g. woocommerce/woocommerce)');
      await cmdSet(wp, args[1], 'active');
      break;
    case 'deactivate':
      if (!args[1]) fail('Plugin slug required (e.g. woocommerce/woocommerce)');
      await cmdSet(wp, args[1], 'inactive');
      break;
    default:
      console.error('Unknown command: ' + cmd + '\n');
      printHelp();
      process.exit(1);
  }
}

main().catch(function (e) {
  console.error('Error: ' + (e.stack || e.message));
  process.exit(1);
});
