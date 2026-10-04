import { snakePoint } from './snake-motion';

export const HERO_SNAKE_DURATION = 5200;
export const HERO_INTRO_KEY = 'vlk-402-hero-intro-v1';

// Follow the header's exact route at a near-uniform speed across Bezier segments.
const distances = [0];
for (let i = 1; i <= 350; i++) {
  const a = snakePoint((i - 1) / 350), b = snakePoint(i / 350);
  distances.push(distances[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
}
const length = distances[350];
function routeProgress(fraction: number) {
  const target = fraction * length;
  let low = 0, high = 350;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (distances[mid] < target) low = mid + 1; else high = mid;
  }
  if (low === 0) return 0;
  return (low - 1 + (target - distances[low - 1]) / (distances[low] - distances[low - 1])) / 350;
}
export function heroSnakeFrame(elapsed: number) {
  // Fade the server-rendered completed emblem gently, then let the head lead.
  if (elapsed < 240) return { progress: 1, opacity: 1 - Math.max(0, elapsed) / 240 };
  const t = Math.max(0, Math.min(1, (elapsed - 240) / (HERO_SNAKE_DURATION - 240)));
  const eased = t * t * (3 - 2 * t);
  return { progress: routeProgress(eased), opacity: Math.min(1, (elapsed - 240) / 180) };
}
