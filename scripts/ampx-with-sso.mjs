import { spawn } from 'node:child_process';

const profile = 'terrasacha-amplify-admin';
const region = 'us-east-1';

const drop = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  'AWS_SECURITY_TOKEN',
  'AWS_CONTAINER_CREDENTIALS_RELATIVE_URI',
  'AWS_CONTAINER_CREDENTIALS_FULL_URI',
  'AWS_WEB_IDENTITY_TOKEN_FILE',
];

const env = { ...process.env };
for (const key of drop) {
  delete env[key];
}

env.AWS_PROFILE = profile;
env.AWS_REGION = region;
delete env.AWS_DEFAULT_REGION;
env.AWS_EC2_METADATA_DISABLED = 'true';

const commands = new Set(['sandbox', 'delete', 'secret', 'seed']);
const args = process.argv.slice(2).filter((arg, index, all) => {
  if (arg.startsWith('-') || commands.has(arg)) {
    return true;
  }
  const previous = all[index - 1];
  return previous === '--identifier' || previous === '--profile';
});
const child = spawn('npx', ['ampx', ...args, '--profile', profile], {
  env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
