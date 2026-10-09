# Facilitator guide

How to run the session with the kit on this site. Times are from the start of the session. Deck slides are numbered as on screen; the game's buttons are quoted as they appear.

## The day before

- Print thirty copies of the handout (`/handout/handout.pdf`, A4) and the score sheets (`/paper/sheets.html`, two A5 sheets per A4 page, fifteen pages for thirty jurors). Scan the three codes on a printed handout with a phone: the room, the working paper and the mailing list must all open.
- Open the room on your laptop and on your phone: `/r/leiden`. If a game from a rehearsal is still there, use "Wipe all" in the host console and confirm.
- Charge the laptop and the phone. The session runs on their batteries if the venue has no sockets.
- Put the deck on the laptop: `/deck/`. Arrow keys move between slides; it reads on a phone too, so participants can follow on their own screen.

## At the venue, before people arrive

The room is the workshop room at the Poortgebouw. The slot on the community map is 14:00 to 15:20, eighty minutes rather than ninety, so plan five nominees (open NumPy only if the room is quick) and keep the objections to twenty-five minutes; the table below is the ninety-minute shape.

- Check the Wi-Fi or mobile signal from both devices. Load `/r/leiden` on the phone over mobile data as well, so you know which network works.
- Summon the jury from the laptop: enter your name, leave the six nominees of the docket ticked (Inkscape, Linux, PDF, LaTeX, arXiv, NumPy), press "Summon a jury and host it". The seven spares stay unticked unless the room is fast; the docket cannot change once summoned.
- Leave the laptop on the lobby screen. Keep the handouts and a few score sheets at hand.

The questions a sceptical room raises beyond the five objections on the deck, with the answer to give and the answer to avoid, are in [likely-questions.md](likely-questions.md).

## Run of show

| Time | Deck | What you do |
|---|---|---|
| 0:00 | 1 to 3 | The claim: who gets how much comes down to numbers nobody can verify or reproduce; "what happened" and "how much does it matter" are two questions, and today is about the second. |
| 0:10 | 4 | Everyone scans the room code on the handout, or types the address. Each person enters a name and presses "Take a seat". Watch the seated count in the status bar reach the room. Remove a duplicate or stray seat with the cross on its chip while still in the lobby. |
| 0:13 | 5 and 6 | Read the policy together: the prompt, the five anchors, the three worked examples, the four things that are not the jury's job. Then how they are paid: nearer the centre, more of the pot; beyond the band, a forfeit that grows with distance. Then the bet on slide 6: say the name before the room does, a Keynesian beauty contest, and say what changes it, the judging criteria are written down; sealed scores leave only the prompt and the evidence in common, so the best forecast of the hidden centre is an honest reading; name the three conditions, a concrete prompt, jurors who know the field or recuse, and no coordination outside the game, because the objections test them. |
| 0:15 | 7 | Before the first round, say the prediction out loud so the demonstration can fail: Inkscape and Linux should give narrow bands with few forfeits, PDF a wide band; if the clear cases come out wide the prompt failed, and if the split case comes out narrow the room herded on something outside the prompt. Then play. Press "Open Inkscape". Sixty seconds show in everyone's status bar. "Close and reveal" unlocks when everyone has sealed or recused, or when time is up. Press it, wait for "Everyone has revealed." (a sleeping phone shows under "Not yet revealed"), press "Grade". Walk the room through its own results: the mean, the band, who was paid, who forfeited, the note under the table. Press "Next nominee". Repeat for Linux, PDF, LaTeX, arXiv and NumPy. About five minutes per nominee. |
| 0:45 | 8 to 12 | The objections, in the order the room raises them, using the room's own rounds: herding, vote buying, collusion (the arXiv round: a majority of the jurors, 55 percent, had a private instruction to score 0.10; the banner on its results says what the bloc did), a vague policy, fake identities. |
| 1:15 | 13 | Where it fits: review panels, grant programmes, community funds. What it costs: a public policy, a docket, a room and an hour. |
| 1:20 | 14 | Close. Say the next step aloud: Arrow, the first funded round of this design, runs at Octant in early 2027 with an invited jury of domain experts; the link is on the slide and the handout. Questions. The paper and the mailing-list codes are on the slide and on the handout. Press "Finish" after the last nominee if you have not already; the final standings stay on every phone. |

The 45-minute version: three nominees (Inkscape, Linux, arXiv), the objections in fifteen minutes, no slide 13.

## While the room plays

- A juror who does not know a nominee presses "I do not know enough": no stake, no share, no fine for silence. They can take the seat back while scoring is open.
- A juror may change a sealed score until you close. The chip shows a small arrow for a changed seal.
- Proofs: by default each juror's proof (score and two words) is on their own screen. Anyone who reads another juror's proof can type it into "Report" and take a bounty from the juror who showed it; the showing juror loses more. "Proofs: on screen" in the host console switches proofs behind a button if you want showing to be a deliberate act.
- A juror whose phone slept through the reveal is counted as not revealing for that nominee; their seal opens when the phone wakes but no longer counts. Say so before the first round so nobody is surprised.
- Late arrivals take a seat whenever they like; they are at stake only from the next nominee you open.

## If something goes wrong

- **Your laptop drops.** Open the room on your phone, press "Take over" and confirm. Hosting moves to the phone with the game intact.
- **The connection is bad for everyone.** Hand out the score sheets, one per juror for the whole docket. Each round, jurors write the score in that nominee's row and fold the sheet; when you say "open", they read their scores aloud in seat order and you type them into `/paper/` on any device that has a signal, or later, and read the results aloud. The same ledger grades them. Collect the sheets at the end if you want the record.
- **A screen says the game moved on.** Someone else pressed a host button first. Look at the screen again; nothing was lost.
- **A nominee goes badly wrong.** "End the game" keeps everything graded so far and shows the final standings. "New game" sends everyone back to the summon screen and reseats them with one tap.
- **A stranger joined the room from the internet.** Remove the seat with its cross in the lobby. The room code is on paper only; wipe the room after the session.

## After the session

- Press "Finish" or "End the game", leave the standings up for photographs, then "Wipe all" and confirm.
- Export the mailing-list sign-ups with the export token (see the README) and import them into your mailer.
- Note what the room said at each objection; the arXiv round's banner is the data point worth keeping.
