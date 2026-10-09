import { roomPath } from "./protocol.js";

const PROJECT = "Decentralized Curation";
const PAPER_DOI = "10.5281/zenodo.20543760";
const PUBLIC_ADDRESS_PLACEHOLDER = "CHANGE-ME";
const SITE = `https://coherence-game.${PUBLIC_ADDRESS_PLACEHOLDER}.workers.dev`;

export const SESSION = Object.freeze({
  title: "Credible consensus among strangers",
  subtitle: "A jury for funding the research commons",
  project: PROJECT,
  event: "Institute of Open Science Practices (IOSP) 2026, Leiden",
  day: "Wednesday 14 October 2026",
  venue: "Venue to be confirmed on the community map",
  site: SITE,
  publicAddressConfirmed: !SITE.includes(PUBLIC_ADDRESS_PLACEHOLDER),
  roomCode: "leiden",
  paperDoi: PAPER_DOI,
  paperUrl: `https://doi.org/${PAPER_DOI}`,
  attribution: `${PROJECT} research by Ferit Tunçer.`,
  licence: "GPL-3.0-only",
});

export function roomUrl() {
  return `${SESSION.site}${roomPath(SESSION.roomCode)}`;
}

export function joinUrl() {
  return `${SESSION.site}/join/`;
}
