const cp = require('child_process');
const path = require('path');

const fixCwd = (options) => {
  if (options && typeof options.cwd === 'string') {
    // Restore the trailing space if the path library stripped it from "Virla "
    if (options.cwd.endsWith('Virla')) {
      options.cwd = options.cwd + ' ';
    }
  }
};

const fixArgs = (args) => {
  if (Array.isArray(args)) {
    return args.map(arg => {
      if (typeof arg === 'string') {
        // Fix file:// URLs that have had the trailing space stripped
        if (arg.startsWith('file:///Users/virral/Desktop/Virla')) {
          if (!arg.includes('Virla%20') && !arg.endsWith('Virla ')) {
            return arg.replace('Virla', 'Virla%20');
          }
        }
        // Fix absolute paths that have had the trailing space stripped
        if (arg.startsWith('/Users/virral/Desktop/Virla')) {
          if (!arg.startsWith('/Users/virral/Desktop/Virla ')) {
            return arg.replace('/Users/virral/Desktop/Virla', '/Users/virral/Desktop/Virla ');
          }
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
  fixCwd(options);
  args = fixArgs(args);
  if (command === 'git') {
    command = '/Library/Developer/CommandLineTools/usr/bin/git';
  }
  return originalSpawn.call(this, command, args, options);
};

// Monkeypatch child_process.spawnSync
const originalSpawnSync = cp.spawnSync;
cp.spawnSync = function (command, args, options) {
  fixCwd(options);
  args = fixArgs(args);
  if (command === 'git') {
    command = '/Library/Developer/CommandLineTools/usr/bin/git';
  }
  return originalSpawnSync.call(this, command, args, options);
};

// Monkeypatch GitClient prototype to restore trailing space in repository root path
try {
  const GitClient = require('./node_modules/eas-cli/build/vcs/clients/git').default;
  const originalGetRootPathAsync = GitClient.prototype.getRootPathAsync;
  GitClient.prototype.getRootPathAsync = async function () {
    const root = await originalGetRootPathAsync.call(this);
    if (typeof root === 'string' && root.endsWith('Virla')) {
      return root + ' ';
    }
    return root;
  };
} catch (e) {
  console.error('[DEBUG WRAPPER] Failed to monkeypatch GitClient:', e);
}

// Require and run oclif with the local eas-cli directory context
const oclif = require('@oclif/core');
oclif.execute({ dir: path.join(__dirname, 'node_modules/eas-cli/bin') });
