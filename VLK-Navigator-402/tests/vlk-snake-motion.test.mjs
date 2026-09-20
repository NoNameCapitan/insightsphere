import test from 'node:test';
import assert from 'node:assert/strict';
import {snakeGeometry,snakePoint,snakeFrame,SNAKE_DURATION} from '../components/vlk/snake-motion.ts';

test('head is always joined to the centreline, including segment boundaries',()=>{
  for(let i=0;i<=700;i++){
    const {path,head}=snakeGeometry(i/700);
    const values=path.match(/[-\d.]+/g).map(Number);
    assert.ok(Math.hypot(values.at(-2)-head[0],values.at(-1)-head[1])<.001);
  }
});
test('trajectory has no position jump at a curve boundary',()=>{
  for(let i=1;i<7;i++){
    const a=snakePoint(i/7-.00001),b=snakePoint(i/7+.00001);
    assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<.02);
  }
});
test('replay fades from completed pose, ends at the exact idle pose in 3.2 seconds',()=>{
  assert.equal(SNAKE_DURATION,3200);
  assert.deepEqual(snakeFrame(0),{progress:1,opacity:1});
  assert.deepEqual(snakeFrame(180),{progress:0,opacity:0});
  assert.deepEqual(snakeFrame(SNAKE_DURATION),{progress:1,opacity:1});
});
test('all animation frames stay finite, inside the emblem, with continuous forward travel',()=>{
  let previous=0;
  for(let t=180;t<=3200;t+=10){
    const {progress,opacity}=snakeFrame(t),{head,angle}=snakeGeometry(progress);
    assert.ok(progress>=previous && progress<=1);previous=progress;
    assert.ok(opacity>=0 && opacity<=1 && Number.isFinite(angle));
    assert.ok(head.every(v=>v>20&&v<85));
  }
});
