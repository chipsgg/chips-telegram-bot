// One-time Discord token hand-off from the Worker (POST /admin/seal-discord). Run on the box:
//   node unseal.js keygen          -> keeps the private key in ./seal.key (0600), prints the public key
//   node unseal.js open <file>     -> decrypts the Worker's sealed JSON, writes DISCORD_TOKEN into
//                                     ./gateway.env (0600, appended), deletes seal.key
// The public key goes on the Worker as DISCORD_SEAL_PUB; delete that secret afterwards.
import { appendFileSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { newKeyPair, open } from "../worker/src/lib/seal.js";

const [cmd, file] = process.argv.slice(2);
if (cmd === "keygen") {
  const { pub, priv } = await newKeyPair();
  writeFileSync("seal.key", JSON.stringify(priv), { mode: 0o600 });
  console.log(pub);
} else if (cmd === "open" && file) {
  const priv = JSON.parse(readFileSync("seal.key", "utf8"));
  const token = await open(priv, JSON.parse(readFileSync(file, "utf8")));
  appendFileSync("gateway.env", `DISCORD_TOKEN=${token}\n`, { mode: 0o600 });
  rmSync("seal.key");
  rmSync(file);
  console.log("DISCORD_TOKEN written to gateway.env");
} else {
  console.error("usage: node unseal.js keygen | open <sealed.json>");
  process.exit(2);
}
