import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
const example = new URL("../backend/.env.example", import.meta.url);
const destination = new URL("../backend/.env", import.meta.url);
const text = (await readFile(example, "utf8")).replace(
  "replace-with-at-least-32-random-characters",
  randomBytes(48).toString("base64url"),
);
try {
  await writeFile(destination, text, { flag: "wx" });
  console.log("Created backend/.env with a random session-signing secret.");
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.log("Kept the existing backend/.env unchanged.");
}
