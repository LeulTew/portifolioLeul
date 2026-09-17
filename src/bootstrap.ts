import { routeOrStart } from './lib/deviceRouting';

void routeOrStart(
  window.location.href,
  navigator,
  destination => window.location.replace(destination),
  () => import('./main'),
).catch((error: unknown) => {
  console.error('Portfolio startup failed:', error);
  const root = document.getElementById('root');
  if (!root) return;
  const message = document.createElement('p');
  message.textContent = 'The portfolio could not load. Please check your connection and try again.';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = 'Reload portfolio';
  retry.addEventListener('click', () => window.location.reload());
  root.replaceChildren(message, retry);
});
