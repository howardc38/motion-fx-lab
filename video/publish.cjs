// Publish a checked bundle. Stage on the destination filesystem and roll back
// every replacement on failure, retaining recovery files if rollback itself fails.
const fs = require("node:fs/promises");
const path = require("node:path");

async function publishBundle(source, destination, names, remove = []) {
  const artifacts = [...remove, ...names];
  if (!artifacts.length || new Set(artifacts).size !== artifacts.length || artifacts.some(name =>
    !name || name === "." || name === ".." || path.basename(name) !== name)) {
    throw new Error("publishBundle requires distinct top-level artifact names");
  }
  await fs.mkdir(destination, { recursive: true });
  const work = await fs.mkdtemp(path.join(destination, ".publish-"));
  const changed = [];
  let retain = false;
  try {
    await fs.mkdir(path.join(work, "next"));
    await fs.mkdir(path.join(work, "previous"));
    // Finish all copies before changing any published artifact.
    for (const name of names) {
      await fs.cp(path.join(source, name), path.join(work, "next", name), { recursive: true });
    }
    // Deletions share the backup/rollback path with replacements. Retire absent
    // optional outputs first so any later install failure restores them too.
    for (const name of artifacts) {
      const target = path.join(destination, name);
      const backup = path.join(work, "previous", name);
      const change = { target, backup, backedUp: false, installed: false };
      changed.push(change);
      try {
        await fs.rename(target, backup);
        change.backedUp = true;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      if (!remove.includes(name)) {
        await fs.rename(path.join(work, "next", name), target);
        change.installed = true;
      }
    }
  } catch (error) {
    const failures = [];
    for (const change of changed.reverse()) {
      try {
        if (change.installed) await fs.rm(change.target, { recursive: true, force: true });
        if (change.backedUp) await fs.rename(change.backup, change.target);
      } catch (rollbackError) {
        failures.push(rollbackError);
      }
    }
    if (failures.length) {
      retain = true;
      throw new AggregateError([error, ...failures], `Publication failed; recover previous artifacts from ${work}`);
    }
    throw error;
  } finally {
    if (!retain) await fs.rm(work, { recursive: true, force: true });
  }
}

module.exports = { publishBundle };
if (require.main === module) {
  const [source, destination, ...args] = process.argv.slice(2);
  (async () => {
    const names = [], remove = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--remove") {
        if (!args[i + 1] || args[i + 1] === "--remove") throw new Error("--remove needs an artifact name");
        remove.push(args[++i]);
      } else names.push(args[i]);
    }
    await publishBundle(source, destination, names, remove);
  })().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
