import { warmNyxVision } from "../lib/nyx-vision.mjs";

const attempts = 3;
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    await warmNyxVision();
    console.log("Nyx local vision model is ready.");
    process.exit(0);
  } catch (error) {
    if (attempt === attempts) {
      console.error(`Could not prepare the Nyx vision model: ${error?.message || error}`);
      process.exit(1);
    }
    console.warn(`Vision model preparation attempt ${attempt} failed; retrying.`);
  }
}
