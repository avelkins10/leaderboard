import { execSync } from 'child_process';

try {
  console.log('Fetching from origin...');
  execSync('git fetch origin main', { stdio: 'inherit', cwd: '/vercel/share/v0-project' });
  console.log('Merging origin/main...');
  execSync('git merge origin/main --no-edit', { stdio: 'inherit', cwd: '/vercel/share/v0-project' });
  console.log('Done!');
} catch (e) {
  console.error('Error:', e.message);
}
