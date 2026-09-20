/** Presentation geometry only. A single centreline drives both body and head. */
export const SNAKE_DURATION = 3200;
type Point = readonly [number, number];
const curves: readonly (readonly [Point, Point, Point, Point])[] = [
  [[53,77],[36,77],[38,69],[48,68]],
  [[48,68],[68,66],[64,61],[49,60]],
  [[49,60],[34,59],[36,53],[51,52]],
  [[51,52],[71,50],[66,44],[54,44]],
  [[54,44],[44,44],[40,40],[44,36]],
  [[44,36],[48,29],[60,28],[60,36]],
  [[60,36],[60,40],[53,40],[49,35]],
];
export function snakePoint(progress: number): Point {
  const scaled = Math.max(0, Math.min(1, progress)) * curves.length;
  const index = Math.min(curves.length - 1, Math.floor(scaled));
  const t = scaled - index, u = 1 - t;
  const [a,b,c,d] = curves[index];
  return [u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0], u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]];
}
export function snakeGeometry(progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  const count = Math.max(1, Math.ceil(p * 120));
  const points = Array.from({length:count+1},(_,i)=>snakePoint(p*i/count));
  const head = points[points.length-1];
  const previous = snakePoint(Math.max(0,p-.002));
  const next = p === 0 ? snakePoint(.002) : head;
  const angle = Math.atan2(next[1]-previous[1],next[0]-previous[0])*180/Math.PI;
  return {path:points.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(3)} ${y.toFixed(3)}`).join(' '),head,angle};
}
export function snakeFrame(elapsed: number) {
  // Brief fade from the completed pose prevents a visible reset on repeat entry.
  if (elapsed < 180) return {progress:1,opacity:1-Math.max(0,elapsed)/180};
  const t=Math.min(1,(elapsed-180)/(SNAKE_DURATION-180));
  const progress=t<.82 ? t/.82*.92 : .92+.08*(1-Math.pow(1-(t-.82)/.18,3));
  return {progress,opacity:Math.min(1,(elapsed-180)/160)};
}
