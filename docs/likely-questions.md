# Likely questions, and the answers to give

The objections a sceptical room raises beyond the five on the deck, in the order they are likely to land hard. Each entry gives the question as it is asked from the floor, the answer, what to concede, and the answer to avoid. Every number comes from running the site's own ledger (`public/core.js`) on rooms of thirty with equal seats. The runs are in `scripts/red-team/`, and the full red-team report is [red-team-2026-10-09.md](red-team-2026-10-09.md).

## 1. "You pay me to forecast the room, not to read the evidence."

Yes, and slide 6 says so first: it is a Keynesian beauty contest. The game pays for coherence with the room, and the phone says so: graded against the jury, not against the truth. The claim is narrower than it sounds. Not that the centre is true, but that it is this jury's shared reading of a public prompt, reproducible from the sealed scores and published with them. What the design changes in Keynes's contest is the judging criteria: written down, with anchors and worked examples, so the thing to anticipate is how careful strangers read a text that is in front of everyone. The bet is that this makes "how the room applies this prompt" and "my own careful reading" the same forecast. The target is the room's mean itself, not two-thirds of it, so the unravelling of the guessing-game experiments does not apply: any shared reading is stable, and the room moves off the evidence only when it shares a belief that others will deviate, which is the famous-nominee case. Where the room's reading tracks fame or taste instead, the prompt failed, and the published results show it.

Concede: a shared prejudice is also a shared reading, and the design cannot tell them apart; only the policy process can.

Avoid: "the band makes a wrong guess expensive" is circular here, since the guess about the room is what is paid. "A sharper prompt fixes it" does nothing for a bias the whole room shares.

## 2. "The band wiped out the one juror who knew better."

It can, and the Linux note says so before anyone asks. The game pays for coherence, not for being right, because nothing in it can verify who was right, and no committee can either. What the design adds is that the 0.75 and the room's 0.92 are both published beside the prompt, so the argument about who read it well happens in public, and the next prompt can carry the expert's point as a worked example.

Concede: a lone juror's knowledge enters the result only through the evidence and the policy, never through their score. Parameter note for a real round: the band floor is 0.0625 of the scale while the anchors sit 0.25 apart, so a tight room can wipe out a juror one anchor step away; set the floor from the anchor spacing.

Avoid: "recuse if you disagree" tells the expert to leave. "They could appeal" has no appeal in the game, and a larger jury from the same room shares its reading.

## 3. "Whoever holds the stake sets the centre and can never forfeit."

Correct for a stake-weighted mean with a band from the same weights: a juror with more than half the stake is the weighted median, and the band always reaches past them. The deck says concentrated stake remains a concern and that the paper establishes no safe collusion threshold; this is that concern in arithmetic. Today's room uses equal seats, and the first funded rounds proposed in the paper seat invited jurors with one seat each and a pay pot they can lose, not stake of their own. Say what stake is: a deposit at risk, posted for a seat, a token when the system runs on a chain.

Avoid: "stake is skin in the game" restates the objection, which is whose skin. "We would cap stake" is identity with extra steps, which slide 12 says stake was meant to replace.

## 4. "You rigged a majority and showed that a majority wins."

Yes, on purpose: the arXiv round demonstrates the attack, not the defence. The bloc is 55 percent of the seats. In this room's arithmetic the forfeit bites a bloc below about a third of the seats; at 40 percent the bloc pays about one percent of its stake, and at 47 percent it is inside the band and paid. The defences against larger blocs, draws and appeals, live outside this hour, and the paper gives no safe threshold.

On the lazy juror: writing 0.50 on everything wins the rigged round and loses the docket. Over six rounds that juror ends 136 percent of an ante down, because the clear cases, Inkscape and Linux, forfeit the whole stake, while the average seated juror ends 85 percent up.

Avoid: "it is only an illustration" makes slide 10 evidence-free. "The random draw dilutes a bloc" is false: a draw from a pool that is 55 percent bloc is 55 percent bloc.

## 5. "The buyer waits for the reveal and pays on the public number."

Correct, and the slide's hedge is about exactly this. The bounty makes pre-reveal verification risky; it does nothing against a buyer who pays afterwards on attributable scores. This is the "P plus epsilon" attack on Schelling-style votes, and the known cryptographic answer is unlinkable reveals. The design keeps scores attributable on purpose, because the same room asks, two questions later, for signed scores and reasons it can hold jurors to. Attributability buys accountability and costs bribe resistance, and the paper chooses accountability. What remains against the patient buyer: the bloc must still be large enough not to forfeit, and a bloc at 0.10 on arXiv is visible by name to everyone.

Avoid: "the buyer cannot verify before the reveal" is irrelevant, the buyer waits. "The buyer has to pay many people" is wrong in the attack's equilibrium, where the buyer pays nobody.

## 6. "Your prompt funds the already-funded, and you wrote it."

The prompt was written for this room, to make one judgment scorable in sixty seconds. Reliance is what it asks, and reliance is not need. A commons fund that wants need writes need into the prompt, and the same game runs on it. The mechanism is policy-agnostic by design; what it adds is that the policy must be written down and published to be scored against, which committees do not do. Who writes the policy and picks the docket is the community's process; the paper proposes open nominations with bonds and challenges for the docket, not performed here.

Concede: in this room both were mine.

Avoid: "the policy is just an example" without the next sentence about what the mechanism does add.

## 7. "A number with no reasons, and a bounty for reporting a colleague."

Two things. Reasons: the game pays on the score and drops reasons for time; nothing stops a jury from publishing reasons with the reveal, and a real round should. Reporting: talking to a colleague about your view is allowed; showing the proof of a sealed score is what can be reported, because the proof is what a buyer would want. Keep your screen to yourself.

Concede: a signed number without a report has the costs of open identity without its benefits; reasons belong in the design.

Avoid: "the reasons are in the policy." The policy is the question; the juror's reason is the answer.

## 8. "0.69 for PDF is a number nobody gave."

True: a mean of a split is not anyone's reading. The design reports the spread with the centre; a wide band is the signal that the room split, and every score is published, so a funder should read centre and band together. On LaTeX: the non-users' reading is the policy's reading, research as a whole, which is why they were paid; whether that reading was right is the prompt's business.

Concede: the single number is a choice presented as arithmetic; the honest output of a split jury is "split, and here is where".

## 9. "Recusal is free and scoring is risky, so the honest leave."

Recusal pays zero. Scoring pays positively for anyone who reads the prompt with the room and negatively for anyone far outside, so the filter is for people who believe they can apply the prompt, which is who a jury should be. In a funded round with invited experts, every juror scores every nominee and conflicts are excluded before seating.

Concede: the filter also admits the overconfident, and no objection slide tests this condition; the docket does, each time a nominee you do not know comes up.

Avoid: "recusal is the honest choice" on its own.

## 10. "By round three everyone knows the room."

Within a round nobody can copy. Across rounds the room learns its own scale, which is calibration rather than herding on a nominee: what leaks is how generous the room is, not the next answer.

Concede: names and balances on every phone, and the notes after each round, make the later rounds easier than the first; a real round scores each project once.

Avoid: "each nominee is a fresh seal."

## 11. "Nobody knows research as a whole, and your anchors count fields."

The anchors are a value judgment, breadth over criticality, made by the prompt-writer and published; a fund that values criticality for small fields writes other anchors. Nobody knows research as a whole, which is why the policy carries tests that evidence can answer: how many rely, what breaks, any substitute. In sixty seconds with a two-sentence blurb the evidence is thin; a real round ships evidence packs.

Concede: under this prompt, infrastructure that matters to one field cannot score above a quarter.

## 12. "Output agreement has uninformative equilibria, and the known fixes reward the opposite."

Right. This is an output-agreement mechanism, and the theory says truthful reporting is an equilibrium only when a juror's own signal is the best predictor of the others'. The public prompt, anchors and evidence are an attempt to make that condition hold; where a famous nominee has a known popular answer that differs from the evidence, it fails and the mechanism pays the popular answer. Output agreement was chosen for legibility: a juror can understand the payout from one picture. Bayesian truth serum and surprisingly-popular scoring have better theory and need a second report from every juror; testing them on the same docket is the obvious next experiment. Keynes, Schelling and output agreement are three names for one situation: Keynes named the worry, Schelling the resolution, and peer prediction the condition under which the resolution holds.

Avoid: "a design argument, not a proof" as the whole answer. The literature has the counter-result; say what we chose and why.

## 13. "This is a Delphi round with a penalty and no reasons."

Close. Delphi feeds back reasons and iterates with a facilitator; it gives no reason for effort or honesty beyond goodwill, and it does not scale to strangers. The game adds a stake and a payout so it can run among strangers without a facilitator, and it is compatible with reasons and with practice rounds. Calibration weighting needs seed questions with known answers; importance has none, which is the point of slide 2.

## 14. "Funders already use lotteries."

Lotteries settle ties above a threshold, and the threshold is still a judgment. A jury can supply it, and a lottery above a jury-set threshold is a good use of these scores. The deck claims no more than scores to inform allocation.

## 15. "This is Kleros."

Kleros and SchellingCoin are the ancestors, and their record is the reason the deck lists collusion and vote buying. What differs: a continuous score with a band from the jury's own spread instead of a binary majority, a linear payout by closeness, a published prompt as the focal point rather than the truth of a dispute, and in the funded rounds a named expert jury under an agreement rather than anonymous stakers. The "vote the expected majority" pathology seen there is the beauty contest of question 1 in the wild.

Avoid: "ours is sealed." So is theirs.

## 16. "Hashes and Bitcoin seed words on your own server."

Today the room runs on my server, so sealing protects you from me and from each other; on a chain it protects you from the operator too, which matters only when money moves and nobody trusts the operator. The salt words come from a public word list chosen because they are easy to type on a phone, and yes, it is the Bitcoin list. For a university panel, a sealed form with a closing time gives the same herding protection.

Avoid: "it is not crypto." Own the lineage and say what the chain is for.

## 17. "What result today would have counted against the design?"

Say the prediction before the first round: Inkscape and Linux should give narrow bands with few forfeits, PDF a wide band, and arXiv is rigged and will be called out. If the clear cases come out wide, the prompt failed; if the split case comes out narrow, the room herded on something outside the prompt. This is a demonstration with a prediction, not an experiment: points, one room, six famous names, my blurbs.

Concede all of that.

## 18. "Project communities will stake to sit on their own juries."

In the funded rounds proposed in the paper, jurors are invited and a conflict of interest excludes a seat. In the open design, interested parties can stake, and "how much you use it" cannot be enforced on a sealed number. Aligned jurors produce a tight band around a biased centre; the published scores let outsiders see the cluster, and the remedy is a challenge or an appeal, not the band.

Concede: coordination among aligned jurors is the open problem, and the paper gives no safe threshold.

## 19. "Appeals cannot fix a shared bias."

Correct. Appeals fix capture by a small bloc. A shared reading is fixed only by changing the prompt, and publication is what makes the shared reading visible. Who pays for an appeal is an open design question.

## 20. "A sleeping phone is a total loss."

Today, points, and we warn the room first. A real round gives a reveal window of days with reminders, and the jurors risk a pay pot, not their own money. With real stake at risk, reveals should be time-locked so that no juror's money depends on being awake; the design allows it.

## 21. "What is 0.43 in euros, and the committee still decides."

In a funded round, a project's share of the pool is its consensus score divided by the sum of all consensus scores; 0.43 is a share, not a price. The budget and the decision to fund stay with the fund. The game replaces the committee's unverifiable numbers with a published, reproducible aggregate of named jurors' sealed readings under a public policy; it does not replace the fund's authority. What it costs: a pay pot per seat, a written policy and the evidence packs.

## 22. "Your deck, handout, guide and game disagree."

They did, in four places, and they are fixed: the handout carries the fifth objection; slide 6 no longer says the objections test all three conditions; the guide says the bloc is a majority of 55 percent; slide 10 says in words where the forfeit stops biting. "Credible consensus" on the slides and "graded against the jury, not against the truth" on the phone are the same claim: credible means public and reproducible, not true.
