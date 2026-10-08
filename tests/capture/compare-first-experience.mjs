import sharp from "sharp";
import path from "node:path";

const root = path.resolve("qa/first-experience");
for (const width of [390, 1440]) {
  for (const [state, source] of [
    ["home", `frames/home-${width}.png`],
    ["input", `frames/compose-${width}-ready.png`],
    ["waiting", `waiting/${width}-normal.png`],
    ["result", `result/${width}-normal.png`],
  ]) {
    const original = path.resolve("test-results/home-option3-prototype/qa", source);
    const actual = path.join(root, `${state}-${width}.png`);
    const [left, right] = await Promise.all([sharp(original).metadata(), sharp(actual).metadata()]);
    const height = Math.min(left.height, right.height);
    await sharp({ create: { width: width * 2 + 16, height, channels: 3, background: "#666" } })
      .composite([
        { input: await sharp(original).extract({ left: 0, top: 0, width, height }).toBuffer(), left: 0, top: 0 },
        { input: await sharp(actual).extract({ left: 0, top: 0, width, height }).toBuffer(), left: width + 16, top: 0 },
      ]).png().toFile(path.join(root, `compare-${state}-${width}.png`));
  }
}

const states = ["home", "input", "waiting", "result"];
await sharp({ create: { width: 390 * 4 + 48, height: 844, channels: 3, background: "#666" } })
  .composite(states.map((state, i) => ({ input: path.join(root, `${state}-390.png`), left: i * 406, top: 0 })))
  .png().toFile(path.join(root, "overview-mobile.png"));

await sharp(path.join(root, "compare-result-1440.png"))
  .extract({ left: 480, top: 560, width: 480, height: 340 }).png().toFile(path.join(root, "source-result-actions.png"));
await sharp(path.join(root, "result-1440.png"))
  .extract({ left: 480, top: 560, width: 480, height: 340 }).png().toFile(path.join(root, "actual-result-actions.png"));
await sharp({ create: { width: 976, height: 340, channels: 3, background: "#666" } })
  .composite([
    { input: path.join(root, "source-result-actions.png"), left: 0, top: 0 },
    { input: path.join(root, "actual-result-actions.png"), left: 496, top: 0 },
  ]).png().toFile(path.join(root, "compare-result-actions.png"));

console.log(`Source left / implementation right: ${root}`);
