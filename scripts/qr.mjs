import { mkdir, writeFile } from "node:fs/promises";
import QRCode from "qrcode";
import { joinUrl, roomUrl, SESSION } from "../public/session.js";

const OUT = new URL("../public/handout/", import.meta.url);
const targets = {
  room: { url: roomUrl(), confirmed: SESSION.publicAddressConfirmed },
  paper: { url: SESSION.paperUrl, confirmed: true },
  join: { url: joinUrl(), confirmed: SESSION.publicAddressConfirmed },
};
const PLACEHOLDER =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="Address awaiting deployment; this is not a quick response code"><rect width="120" height="120" fill="#fff"/><rect x="1" y="1" width="118" height="118" fill="none" stroke="#d4cfc1" stroke-dasharray="4 4"/><text x="60" y="55" text-anchor="middle" font-family="monospace" font-size="10" fill="#5e5647">Address pending</text><text x="60" y="72" text-anchor="middle" font-family="monospace" font-size="9" fill="#5e5647">Not a code</text></svg>\n';
await mkdir(OUT, { recursive: true });
for (const [kind, { url, confirmed }] of Object.entries(targets)) {
  const file = `qr-${kind}.svg`;
  const pending = !confirmed;
  const svg = pending
    ? PLACEHOLDER
    : await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 4 });
  await writeFile(new URL(file, OUT), svg);
  console.log(pending ? `${file}: explicit placeholder; final address pending` : `${file}: ${url}`);
}
