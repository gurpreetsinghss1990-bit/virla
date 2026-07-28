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

// Monkeypatch child_process.spawn
const originalSpawn = cp.spawn;
cp.spawn = function (command, args, options) {
  fixCwd(options);
  if (command === 'git') {
    command = '/Library/Developer/CommandLineTools/usr/bin/git';
  }
  return originalSpawn.call(this, command, args, options);
};

// Monkeypatch child_process.spawnSync
const originalSpawnSync = cp.spawnSync;
cp.spawnSync = function (command, args, options) {
  fixCwd(options);
  if (command === 'git') {
    command = '/Library/Developer/CommandLineTools/usr/bin/git';
  }
  return originalSpawnSync.call(this, command, args, options);
};

// Require and run oclif with the local eas-cli directory context
const oclif = require('@oclif/core');
oclif.execute({ dir: path.join(__dirname, 'node_modules/eas-cli/bin') });
