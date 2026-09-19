import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
export async function ask(label: string, secret = false) {
  let muted = false;
  const sink = new Writable({
    write(chunk, _encoding, done) {
      if (!muted) process.stdout.write(chunk);
      done();
    },
  });
  const rl = createInterface({
    input: process.stdin,
    output: sink,
    terminal: !!process.stdin.isTTY,
  });
  const promise = rl.question(label);
  muted = secret;
  const value = await promise;
  rl.close();
  if (secret) process.stdout.write("\n");
  return secret ? value : value.trim();
}
