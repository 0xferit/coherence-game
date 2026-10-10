# Facilitator guide

How to run the session with the kit on this site. Times are from the start of the session. Deck slides are numbered as on screen; the game's buttons are quoted as they appear.

## The day before

- Print thirty copies of the handout (`/handout/handout.pdf`, A4) and the score sheets (`/paper/sheets.html`, two A5 sheets per A4 page, fifteen pages for thirty jurors). Scan the three codes on a printed handout with a phone: the room, the working paper and the mailing list must all open.
- Rehearse in a separate room on your laptop and phone. Check joining, sealing, automatic opening, grading and host takeover; keep the session room for the session.
- Charge the laptop and the phone. The session runs on their batteries if the venue has no sockets.
- Put the deck on the laptop: `/deck/`. Arrow keys move between slides; it reads on a phone too, so participants can follow on their own screen.

## At the venue, before people arrive

The slot is eighty minutes. Keep the six default nominees: each has three minutes for processing and two additional minutes for debriefing. The table below leaves twenty-four minutes for objections and starts the close with five minutes remaining.

- Check the Wi-Fi or mobile signal from both devices. Open the handout's room link on the phone over mobile data as well, so you know which network works.
- If a shared display is available, show the deck and keep the host controls on your laptop. Without one, direct participants to `/deck/` from the site's home page and name each slide as you reach it; let them return to the game before you open a nominee. Read the policy and the result summaries aloud in either mode.
- Summon the jury from the laptop: enter your name, leave the default docket ticked, press "Summon a jury and host it". Leave the spares unticked; the docket cannot change once summoned.
- Leave the laptop on the lobby screen. Keep the handouts and a few score sheets at hand.

The questions a sceptical room raises beyond the five objections on the deck, with the answer to give and the answer to avoid, are in [likely-questions.md](likely-questions.md).

## Run of show

| Time | Deck | What you do |
|---|---|---|
| 0:00 to 0:06 | 1 to 3 | Who gets how much depends on judgments no proof can settle. The question today is whether a public policy, sealed readings and explicit incentives can make that judgment credible. Distinguish verifiable facts from importance under a policy. Ask participants to keep track of what the mechanism rewards and what it cannot establish. |
| 0:06 to 0:10 | 4 | Everyone scans the room code on the handout, or types the printed address. Each person enters a name and presses "Take a seat". Check the seated count against the people joining. Remove a duplicate or stray seat with the cross on its chip while still in the lobby. |
| 0:10 to 0:18 | 5 and 6 | Read the prompt, anchors, worked examples and exclusions together. Demonstrate the centre, spread and band with the payment widget. Name a Keynesian beauty contest with the judging criteria written down. The curation policy is the Schelling prompt: it asks for honest judgment. Jurors who expect the others to follow it have a reason to follow it too. The bet is that this shared expectation makes honest reading the focal strategy. Sealed scores keep a visible first score from displacing the prompt. Honest jurors can still disagree, and shared bias can still produce agreement. It is a design argument, not a proof. |
| 0:18 to 0:48 | 7 | Play the default docket in order. Budget three minutes for collecting, opening and grading each nominee, then two minutes for its debrief. Announce the grading cutoff before opening each nominee. Use the procedure and debrief prompts below. |
| 0:48 to 1:12 | 8 to 12 | Take objections in the order the room raises them: herding, vote buying, collusion, a vague policy, fake identities. Use the actual results. The full design uses commit and reveal, anti-prereveal games and appeals as deterrents to collusion; today's game demonstrates sealing and proof reporting, but does not perform appeals. Use the arXiv banner to distinguish the assigned bloc, compliance and what the revealed scores earned. |
| 1:12 to 1:15 | 13 | Review panels, grant programmes and community funds are possible uses. A community must choose its policy and what to do with the scores. Ask which limitation matters most for the use the room has in mind. |
| 1:15 to 1:20 | 14 | Start with a one-minute understanding check: ask one participant to explain what sets the centre and band, and another to name a limit that agreement cannot settle. Read the current follow-up announcement shown on the slide and handout; its authoritative wording is `SESSION.nextRound` in `public/session.js`. Take final questions. The working-paper and mailing-list codes are on both. Press "Finish" after the last nominee if you have not already; the final standings stay on every phone. |

These are facilitation allowances, not changes to the game's scoring clock. If device recovery or paper collection takes longer, shorten the later discussion explicitly rather than treating processing and debriefing as the same three minutes.

The band follows the paper's weighted standard deviation, with no distance forfeits at essentially zero spread. Individual payouts use the paper's relative-distance rule: shares grow with closeness to the centre, and identical scores share by stake. Stake is equal for every workshop seat. Forfeits join the pot. The workshop simplification concerns the total base reward: each round with opened scores pays it in full, while the paper reduces it at low dispersion. Read the public simplification note on the deck and handout; its authoritative wording is `SESSION.workshopReward` in `public/session.js`.

## Opening and debriefing each round

Before the first round, say: "My expectation is that the portable document format (PDF) round's band will be wider than both Inkscape's and Linux's. If it is not, that expectation was wrong. The scores alone cannot tell us why. We will hear how jurors applied the policy and compare that reasoning with what the game rewarded. Today demonstrates the arithmetic and its failure modes; it does not establish that the incentives improve judgment."

Announce the grading cutoff in advance, then press "Open" for the nominee. In rehearsal, reserve the last thirty seconds of each three-minute processing window for waking phones, opening seals and grading. This is a facilitation target; the game's scoring clock stays as it is. "Close and reveal" unlocks when everyone has sealed or recused, or when the scoring clock runs out. After pressing it, ask everyone to wake their phone and keep the room open: connected phones open their stored seals automatically. Check "Not yet revealed" and allow reconnecting phones to open before the announced cutoff. A person who never sealed or lost the stored salt cannot open this round. Do not require "Everyone has revealed" to proceed. Pressing "Grade" sets the cutoff; a reveal arriving afterwards is recorded but excluded from the result.

Read the centre, band, who was paid and who forfeited. Invite brief answers to the same three prompts:

1. Which policy test most influenced your score?
2. What did the game reward in this round?
3. What can this result tell us, and what remains a judgment?

Then press "Next nominee". On arXiv, compare the banner's assigned bloc with the number who submitted its instructed score. A matching score does not establish a juror's motive. Assignment is sampled seat by seat, so it does not guarantee a majority, compliance or a successful attack. If the bloc is paid, discuss capture; if it forfeits, discuss where the penalty bites. Neither outcome establishes a safe collusion threshold.

## While the room plays

- A juror who does not know a nominee presses "I do not know enough": no stake, no share, no fine for silence. They can take the seat back while scoring is open.
- A juror may change a sealed score until you close. The chip shows a small arrow for a changed seal.
- Proofs: by default each juror's proof (score and two words) is on their own screen. Another juror seated for that nominee can type the proof into "Report" and take a bounty from the juror who showed it; the showing juror loses more. "Proofs: on screen" in the host console switches proofs behind a button if you want showing to be a deliberate act.
- A sleeping phone can still open its seal when it wakes before "Grade". Sleep itself is not a forfeit; missing the grading cutoff is. A non-recused seated juror with no timely reveal loses their stake if at least one score opens. If nobody opens a score, the round is void and there are no absence forfeits. Explain the cutoff before the first round.
- Late arrivals take a seat whenever they like; they are at stake only from the next nominee you open.

## If something goes wrong

- **Your laptop drops.** Open the room on your phone, press "Take over" and confirm. Hosting moves to the phone with the game intact.
- **The connection is bad for everyone.** Switch to the paper procedure below. Collecting thirty paper scores may exceed the phone allowance; adjust the later discussion time explicitly.
- **A screen says the game moved on.** Someone else pressed a host button first. Look at the screen again; nothing was lost.
- **A nominee goes badly wrong.** "End the game" keeps everything graded so far and shows the final standings. "New game" sends everyone back to the summon screen and reseats them with one tap.
- **A stranger joined the room from the internet.** Remove the seat with its cross in the lobby. The room link is public, and anyone with the code can join; wipe the room after the session.

## Paper fallback

Hand out the score sheets, one per juror for the whole docket. Each round, jurors write the score in that nominee's row and fold the sheet. When you say "open", they read their scores aloud in seat order and you type them into the paper calculator (`public/paper/index.html`, served at `/paper/`) on any device that has a signal, or later. Read the results aloud. The same ledger grades them.

Keep names consistent and enter a score or explicit recusal for each juror in each played round. An omitted name is an absence when at least one score opens. The calculator treats every name entered anywhere as seated in every entered round. For a late arrival, enter "recuse" in earlier rounds to avoid an absence forfeit and explain that this is a calculator workaround. Leave an entire unplayed round blank.

The paper version has no private bloc instruction: everyone scores arXiv under the shared policy. Discuss collusion with the slide 10 illustration. If switching mid-session, start fresh paper standings and announce the reset: "The paper standings start from this point. Earlier live balances are not carried over." The calculator does not import earlier live balances.

Collect the sheets at the end if you want the record.

## After the session

- Press "Finish" or "End the game", leave the standings up for photographs, then "Wipe all" and confirm.
- Export mailing-list sign-ups from both the current and former deployments with their separate export tokens, merge the two lists, and import them into your mailer. Follow the secret and export instructions in `README.md`.
- Note what the room said at each objection; the arXiv round's banner is the data point worth keeping.
