const { spawn } = require('child_process');

const env = { ...process.env };
if (Object.prototype.hasOwnProperty.call(env, 'ELECTRON_RUN_AS_NODE')) {
  delete env.ELECTRON_RUN_AS_NODE;
}

const electronPath = require('electron');
const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});
