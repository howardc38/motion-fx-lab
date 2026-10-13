// Point Git at the versioned hooks in .githooks/ (core.hooksPath). Safe to run repeatedly.
// The setting lives in the repository config, so it applies to every worktree of this clone; each
// worktree then runs the .githooks/ of its own checkout (a checkout without .githooks/ runs no hooks,
// so install only once .githooks/ is on the branch you work from). --force replaces a different hooksPath.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const HOOKS = '.githooks';
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tryGit = (...args) => { try { return git(...args); } catch { return ''; } };

function install({ force = false } = {}) {
  const hooks = fs.readdirSync(path.join(ROOT, HOOKS)).filter(name => !name.startsWith('.'));
  if (!hooks.includes('pre-push')) throw new Error(`${HOOKS}/pre-push is missing`);
  for (const name of hooks) {
    const file = path.join(ROOT, HOOKS, name), mode = fs.statSync(file).mode;
    if ((mode & 0o111) !== 0o111) fs.chmodSync(file, mode | 0o111);
  }
  const current = tryGit('config', '--local', '--get', 'core.hooksPath');
  if (current === HOOKS) return { changed: false, hooks };
  if (current && !force) throw new Error(`core.hooksPath is already "${current}"; rerun with --force to replace it with ${HOOKS}`);
  git('config', '--local', 'core.hooksPath', HOOKS);
  // Hooks in the default folder stop running once core.hooksPath is set; list them so nothing is lost silently.
  const legacyDir = path.resolve(ROOT, git('rev-parse', '--git-common-dir'), 'hooks');
  const legacy = fs.existsSync(legacyDir) ? fs.readdirSync(legacyDir).filter(name => !name.endsWith('.sample')) : [];
  return { changed: true, hooks, previous: current, legacy: legacy.map(name => path.join(legacyDir, name)) };
}

if (require.main === module) {
  try {
    const result = install({ force: process.argv.includes('--force') });
    if (!result.changed) console.log(`Hooks already installed: core.hooksPath=${HOOKS} (${result.hooks.join(', ')}).`);
    else {
      console.log(`Hooks installed: core.hooksPath=${HOOKS} (${result.hooks.join(', ')}), shared by every worktree of this clone.`);
      if (result.previous) console.log(`Replaced the previous core.hooksPath "${result.previous}".`);
      if (result.legacy.length) console.log('These hooks no longer run; .githooks/pre-push includes the old local push guard. Review, then delete:\n  ' + result.legacy.join('\n  '));
    }
  } catch (error) { console.error('install-hooks: ' + error.message); process.exitCode = 1; }
}
module.exports = { install, HOOKS };
