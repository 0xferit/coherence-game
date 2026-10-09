function frozen(value) {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) frozen(child);
    Object.freeze(value);
  }
  return value;
}

export const POLICY = frozen({
  scope: "open infrastructure that research depends on",
  prompt:
    "How much does this nominee’s completed and maintained work underpin how research is done, shared and kept, now?",
  anchors: [
    ["0.00", "not infrastructure"],
    ["0.25", "matters to one field"],
    ["0.50", "relied on in several fields"],
    ["0.75", "widely relied on"],
    ["1.00", "research stops without it"],
  ],
  tests: ["how many rely", "what breaks without it", "any substitute"],
  worked: [
    [
      "0.90",
      "the identifier behind most papers’ links",
      ["most fields, most citations", "links, indexes, metrics", "few, at scale"],
    ],
    [
      "0.55",
      "a free data format many instruments and simulations write to",
      ["many labs, often unknowingly", "those labs’ pipelines and archives", "a few, for new data"],
    ],
    [
      "0.10",
      "a much-loved colour map for scientific plots",
      ["millions of figures", "nothing; it’s finished", "plenty"],
    ],
  ],
  separate: [
    "Quality of its contents",
    "Who runs or funds it",
    "How much you use it",
    "Your own field or taste",
  ],
});

const DEFAULT_NOMINEES = [
  {
    key: "inkscape",
    name: "Inkscape",
    blurb:
      "The free vector drawing program, built largely by volunteers since 2003, behind a great many conference posters, journal figures and lab logos.",
    note: "The bottom of the scale, the same shape as the worked colour map. You may have made your last poster in it; that is how much you use it, and it is excluded. Little in research breaks without it: the few pipelines that call it to convert SVG have other converters, and substitutes are plentiful. Scoring it high scores good software; the prompt asks a narrower thing.",
  },
  {
    key: "linux",
    name: "Linux",
    blurb:
      "The free operating system most researchers don’t run on their laptop, yet it runs every machine on the TOP500 list of the fastest supercomputers, and most of the clusters and cloud servers where analysis happens.",
    note: "The top of the scale, and the tightest jury. When everyone agrees the band narrows with them: a juror at 0.75 among a jury at 0.92 can forfeit while being, in any ordinary sense, right. Coherence is measured against the room.",
  },
  {
    key: "pdf",
    name: "PDF",
    blurb:
      "The format most papers are downloaded and read in. Adobe created it in 1993 and published the spec free from the start; since 2008 it has been an ISO standard (ISO 32000), kept up by an ISO committee.",
    note: "Reliance is enormous, and the split comes from the third test. HTML and JATS versions of papers now sit beside the PDF on arXiv and PubMed Central, so some jurors will say a substitute is arriving; others will say most of the literature still exists only as PDF. ‘PDF is where data goes to die’ is taste: excluded. Both readings of ‘any substitute’ are inside the policy; the band is set by the larger group, and the smaller one pays for the split.",
  },
  {
    key: "latex",
    name: "LaTeX",
    blurb:
      "The typesetting system much of mathematics, physics and computer science is written in. Knuth froze his TeX engine in 1990, bar bug fixes; LaTeX runs on successors such as pdfTeX and LuaTeX, kept up by a small volunteer team.",
    note: "Your field is not the field. A mathematician cannot picture research without it; a clinician may never have opened it, because Word does the job there. The prompt asks about research as a whole, so your own field gets no extra weight. Jurors who score their own desk scatter, and the band is as wide as the larger group's agreement, so the scattered ones pay.",
  },
  {
    key: "arxiv",
    name: "arXiv",
    blurb:
      "The preprint server where much of physics, mathematics and computer science has appeared first since 1991: more than three million papers, free to post and free to read. Moderated, not peer-reviewed.",
    note: "The honest read is high: whole fields read it before any journal, it is free at both ends, and nothing replaces it at its scale. ‘It’s flooded with AI-written papers’ is a real worry, and it is a judgment of the quality of its contents: excluded by name. A cluster near 0.10 was following an instruction, not the policy. Whether it paid for that depends on how much of the jury it held.",
    bloc: true,
    blocScore: "0.10",
    blocCover: "it’s flooded with AI-written papers",
  },
  {
    key: "numpy",
    name: "NumPy",
    blurb:
      "The array library underneath scientific Python: SciPy, pandas, scikit-learn and Astropy are built on it. It was part of the software behind the first image of a black hole and the first detection of gravitational waves.",
    note: "Reach in builders, not users. Many researchers never type its name, yet most Python analyses they run pass through it, and ‘how many rely’ counts them too. Remove it and most of scientific Python stops; look-alikes such as CuPy copy its interface, not its place underneath. R users may land lower than Python users: the field effect again, and the mean reflects the whole room.",
  },
];

const SPARE_NOMINEES = [
  {
    key: "swh",
    name: "Software Heritage",
    blurb:
      "The archive of publicly available source code, started at Inria in 2016 and backed by UNESCO since 2017. It keeps copies of code from hosts that have since shut down, such as Google Code and Gitorious.",
    note: "The three tests disagree. Most researchers never open it directly, and if it stopped today little would break this week beyond Guix source fallbacks and SWHID links. But for code gone from its original host it can be the only copy left, and ‘kept’ is in the prompt. Weigh this week and you land low; weigh the record and you land high. The band follows whichever reading more of the jury takes.",
  },
  {
    key: "git",
    name: "Git",
    blurb:
      "The version-control tool Linus Torvalds wrote in 2005 for the Linux kernel. GitHub, owned by Microsoft, is a platform built around it; Git itself is free software, a Software Freedom Conservancy project, not GitHub.",
    note: "Score the layer named. Much shared research code lives in Git repositories, and the instinct is to score GitHub, the brand people see. Git is the free tool under GitHub, GitLab and many labs’ own servers; without it, that code loses the tool that records its history. Who owns the website is excluded either way.",
  },
  {
    key: "orcid",
    name: "ORCID",
    blurb:
      "The free, persistent identifier that tells one J. Wang from another, run by a non-profit funded by its members. Many funders and publishers now require one at application or submission.",
    note: "Reliance by mandate. Many researchers hold an iD only because a funder or journal required one, and some resent it; that is taste, excluded. ‘How many rely’ does not ask why: the grant and submission systems that check iDs, NIH’s among them, would degrade without it, and no open substitute works across all of them.",
  },
  {
    key: "openalex",
    name: "OpenAlex",
    blurb:
      "The open, CC0 index of scholarly works, authors and institutions, launched by a non-profit in 2022 as Microsoft retired its academic graph. Sorbonne University dropped Web of Science for it in 2024.",
    note: "The substitute test with a price on it. Web of Science and Scopus do much of the same job, for a subscription many institutions cannot pay. The policy asks ‘any substitute’, not ‘any free one’: a paid substitute is weaker, not none. Its own heavy application programming interface use is now metered; the data stays free. Gaps in its metadata are a quality complaint: excluded.",
  },
  {
    key: "ojs",
    name: "Open Journal Systems",
    blurb:
      "The free, open source publishing software from the Public Knowledge Project. It runs tens of thousands of journals in well over a hundred countries, most of them outside Europe and North America.",
    note: "Relied on unknowingly, mostly far from here. Readers of these journals rarely know what software runs them, and most of the journals charge neither readers nor authors, so a paid platform is often out of reach. ‘How many rely’ is not ‘how many have heard of it’. Substitutes exist on paper; for a volunteer journal with no budget, few are real.",
  },
  {
    key: "rstudio",
    name: "RStudio",
    blurb:
      "The open source editor many R users write their analyses in, licensed under the GNU Affero General Public License and built by Posit, a public benefit corporation that was itself called RStudio until 2022.",
    note: "Open is not the same as a commons. A company directs it, and who controls the roadmap is excluded, so docking it for that scores something the policy set aside. What decides is the substitute: R runs fine in VS Code, Emacs or a terminal. Heavy use, mild reliance: the same shape as Inkscape, whatever its fame.",
  },
  {
    key: "osm",
    name: "OpenStreetMap",
    blurb:
      "The open map of the world, built mostly by volunteers alongside paid corporate teams, under the Open Database License. Navigation apps, humanitarian responders and many research projects use it.",
    note: "Score the research slice. Its general reach is enormous, but the prompt asks how much research stands on it: geography, urban and transport studies, and disaster and health mapping use it heavily; most of research never touches it. Score the map’s fame and you land high; score the prompt and you land in the lower middle.",
  },
];

export const NOMINEES = frozen(DEFAULT_NOMINEES.concat(SPARE_NOMINEES));
export const DEFAULT_DOCKET_KEYS = frozen(DEFAULT_NOMINEES.map((nominee) => nominee.key));
