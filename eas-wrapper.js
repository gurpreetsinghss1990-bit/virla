const cp = require('child_process');
const path = require('path');

const fixCwd = (options) => {
  if (options && typeof options.cwd === 'string') {
    options.cwd = options.cwd.replace(/Virla(?! )/g, 'Virla ');
  }
};

const fixArgs = (args) => {
  if (Array.isArray(args)) {
    return args.map(arg => {
      if (typeof arg === 'string') {
        if (arg.includes('file:///Users/virral/Desktop/Virla')) {
          return arg.replace(/Virla(?!%20)/g, 'Virla%20');
        }
        if (arg.includes('/Users/virral/Desktop/Virla')) {
          return arg.replace(/Virla(?! )/g, 'Virla ');
        }
      }
      return arg;
    });
  }
  return args;
};

// Monkeypatch child_process.spawn
const originalSpawn = cp.spawn;
cp.spawn = function (command, args, options) {
  console.log('[DEBUG WRAPPER] Spawn called with command:', command, 'args:', args, 'cwd:', options ? options.cwd : undefined);
  fixCwd(options);
  args = fixArgs(args);
  if (command === 'git') {
    command = '/usr/bin/git';
  }
  return originalSpawn.call(this, command, args, options);
};

// Monkeypatch child_process.spawnSync
const originalSpawnSync = cp.spawnSync;
cp.spawnSync = function (command, args, options) {
  console.log('[DEBUG WRAPPER] SpawnSync called with command:', command, 'args:', args, 'cwd:', options ? options.cwd : undefined);
  fixCwd(options);
  args = fixArgs(args);
  if (command === 'git') {
    command = '/usr/bin/git';
  }
  return originalSpawnSync.call(this, command, args, options);
};

// Monkeypatch GitClient prototype to restore trailing space in repository root path
try {
  const GitClient = require('./node_modules/eas-cli/build/vcs/clients/git').default;
  const originalGetRootPathAsync = GitClient.prototype.getRootPathAsync;
  GitClient.prototype.getRootPathAsync = async function () {
    const root = await originalGetRootPathAsync.call(this);
    if (typeof root === 'string') {
      return root.replace(/Virla(?! )/g, 'Virla ');
    }
    return root;
  };
} catch (e) {
  console.error('[DEBUG WRAPPER] Failed to monkeypatch GitClient:', e);
}

// Require and run oclif with the local eas-cli directory context
const oclif = require('@oclif/core');
oclif.execute({ dir: path.join(__dirname, 'node_modules/eas-cli/bin') });
