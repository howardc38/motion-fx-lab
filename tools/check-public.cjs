// Check the actual Git candidates, not a staging directory containing local work.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { films, validate, sync } = require('./films.cjs');
const ROOT = path.resolve(__dirname, '..');
const auxiliaryExamples = ['examples/character-workbench.html', 'examples/fight-source.html', 'examples/studio.html', 'examples/films.json'];
const examplePaths = new Set([...films.map(f => f.source.split('?')[0]), ...auxiliaryExamples]);
// Names of private workspaces on this machine, read from ignored links such as deliverables/ -> <private>/deliverables
// and from FX_PROJECT_ROOT, so the checker itself never publishes them. Absolute paths are caught separately.
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function privateNames(root = ROOT) {
  const names = new Set((process.env.FX_PRIVATE_NAMES || '').split(',').map(s => s.trim()).filter(Boolean));
  if (process.env.FX_PROJECT_ROOT) names.add(path.basename(path.resolve(process.env.FX_PROJECT_ROOT)));
  const realRoot = fs.realpathSync(root);
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isSymbolicLink()) continue;
    try {
      const link = path.join(root, entry.name), next = path.resolve(root, fs.readlinkSync(link));
      if ([root, realRoot].some(r => next.startsWith(r + path.sep))) continue;
      const target = fs.realpathSync(link);
      names.add(path.basename(path.basename(target) === entry.name ? path.dirname(target) : target));
    } catch {}
  }
  names.delete(path.basename(root));
  return [...names];
}
const names = privateNames();
const localPattern = new RegExp(['\\/Users\\/', '\\/home\\/', 'docs\\/video-creation', 'docs\\/character-animation', ...names.map(escape)].join('|'));
function inspect(files, root = ROOT) {
  const errors = [];
  for (const file of files) {
    if (/^(docs|prompts|deliverables|production|local|effect-reference)\//.test(file) || /(^|\/)(imagegen-prompt|read-log|creative-direction|production-execution|storyboard)[^/]*\.(txt|md|jsonl?|html)$/.test(file)) errors.push('Non-public material: ' + file);
    if (file.startsWith('examples/') && !examplePaths.has(file) && !file.startsWith('examples/stack-lab/')) errors.push('Unregistered example: ' + file);
    const absolute = path.join(root, file);
    if (!fs.existsSync(absolute)) { errors.push('Missing file: ' + file); continue; }
    if (fs.lstatSync(absolute).isSymbolicLink()) errors.push('Symlink cannot be published: ' + file);
    if (/\.(html|md|js|json|py|sh)$/.test(file) && !file.startsWith('tests/')) {
      const text = fs.readFileSync(absolute, 'utf8');
      if (localPattern.test(text)) errors.push('Local/private dependency: ' + file);
    }
  }
  return errors;
}
if (require.main === module) {
  try {
    const files = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean))];
    const errors = inspect(files);
    if (errors.length) throw new Error(errors.join('\n'));
    validate(); sync(true);
    console.log(`Public scope OK: ${files.length} Git candidates, ${films.length} films, ${films.length * 3} media files.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { inspect, privateNames };
