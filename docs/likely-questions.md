# Likely questions, and the answers to give

Use the room's actual results when answering. Each entry gives an answer, a limitation to concede and an answer to avoid where a tempting reply would overstate the design. The ledger is `public/core.js`; the scenarios in `scripts/red-team/` run against the current ledger. The [red-team report](red-team-2026-10-09.md) records an earlier workshop version with different band arithmetic; its numerical thresholds are historical, not current predictions. The approved follow-up announcement is defined once as `SESSION.nextRound` in `public/session.js` and rendered on the deck and handout.

## 1. "You pay me to forecast the room, not to read the evidence."

Yes: a Keynesian beauty contest with the judging criteria written down. The curation policy is the Schelling prompt: it asks for honest judgment. Jurors who expect the others to follow it have a reason to follow it too. The bet is that this shared expectation makes honest reading the focal strategy. Sealed scores keep a visible first score from displacing the prompt. The ledger pays for coherence with the jury, not for being right. A credible result here means public and reproducible; it does not establish truth.

Concede: an expectation that others will follow a shared bias can also make agreement pay. The game cannot identify the quality of a reading from agreement alone. This is a design argument, not a proof.

Avoid: "your own reading is always your best forecast" or "a sharper prompt fixes every shared bias."

## 2. "The band wiped out the one juror who knew better."

It can penalize informed dissent. A juror's distance from the centre determines the distance forfeit; the ledger cannot verify that the minority had better evidence. Publishing the policy and every opened score makes the disagreement inspectable. Hear the juror's reason before treating a forfeit as a bad reading.

Concede: the workshop has no appeal or reason field, so it cannot repair that result within the round. At essentially zero spread, distance forfeits are disabled; that numerical rule does not identify which judgment was informed.

Avoid: "recuse if you disagree" or "the expert could appeal today."

## 3. "Whoever holds the stake sets the centre and can never forfeit."

Within one round, a juror holding more than half its stake stays inside this band and cannot lose that stake through distance forfeits. Their weight affects both the mean and the spread. The proposed design draws seats from locked tokens: more drawn seats give a curator more weight on one score, not more independent readings. Stake is the deposited capital locked and at risk for that round. Today's game uses equal seats and points; it does not test the distribution of capital in an open pool.

Concede: capital concentration is a material limit, and a larger jury need not remove it. A penalty tied to the same weighted scores does not make concentrated influence safe.

Avoid: "stake is skin in the game" as an answer to whose capital carries influence, or a universal safe collusion threshold.

## 4. "You rigged a majority and showed that a majority wins."

The live bloc is sampled seat by seat; it is not a guaranteed majority. The arXiv banner reports assignment among the revealed jurors and how many submitted the instructed score. A matching score does not establish a juror's motive. We deliberately introduce an attack, then inspect what it earned. If it pays, discuss capture; if it forfeits, discuss where the penalty bites. If no assigned juror submits that score, say that this attack did not appear in the revealed scores.

Concede: this demonstrates one realised configuration. It does not establish the prevalence of collusion, a safe threshold or the effectiveness of the full deterrents. The full design uses commit and reveal, anti-prereveal games and appeals; the workshop does not perform appeals.

Avoid: "the bloc always wins", "the bloc always pays for cheating" or "a random draw dilutes a bloc's expected share of the pool."

## 5. "The buyer waits for the reveal and pays on the public number."

That arrangement is outside what the proof-reporting bounty deters. The bounty makes proving a sealed score before reveal risky; afterwards, the workshop publishes names and scores. The P plus epsilon attack is a relevant objection. Commit and reveal, anti-prereveal games and appeals are deterrents in the full design, not a claim that every bribery arrangement fails.

Concede: publicly attributable scores can help outsiders inspect a result and can help a buyer verify it. The workshop does not resolve that tradeoff.

Avoid: "the buyer cannot verify before the reveal", which does not answer a buyer who waits.

## 6. "Your prompt funds the already-funded, and you wrote it."

This prompt asks about reliance, not funding need. A community that values need must express that in its policy. Committees can already publish assessment criteria. This design combines a public policy, sealed scoring, a reproducible ledger and payments tied to coherence. Whether that combination improves assessment is a question to test.

Concede: I chose the workshop policy and docket. The mechanism does not settle who should write a policy or which values it should encode.

Avoid: "the policy is just an example" without explaining what participants can assess about the mechanism using it.

## 7. "A number with no reasons, and a bounty for reporting a colleague."

The workshop collects scores and leaves reasons to the debrief. Reporting applies to a proof of a sealed score, not merely a conversation about the policy. Only jurors seated for that nominee can report; keep your proof private.

Concede: publishing scores makes an aggregate reproducible, but it does not supply the reasons needed to assess a juror's reading. A fuller process can collect reasons; today's ledger does not grade them.

Avoid: "the reasons are in the policy." The policy is the shared prompt, not each juror's explanation.

## 8. "The centre for the portable document format (PDF) is a number nobody gave."

Yes: a mean can fall between clusters without representing anyone's reading. Read the centre, spread and individual scores together. The band determines payment eligibility; it is not a confidence interval or evidence that all jurors agree.

Concede: a split jury may be better described as "split, and here is where" than by its centre alone. The result cannot tell us whose substitute test was better without hearing their reasons.

Avoid: treating a centre between two groups as an agreed compromise.

## 9. "Recusal is free and scoring is risky, so the honest leave."

Recusal carries no scoring stake, share or absence forfeit. Participation can pay or lose points, depending on the jury's result. That may encourage people who believe they can apply the policy to score, but it is not a competence test.

Concede: uncertainty, confidence and expertise need not move together. Hear why people recused, without treating disagreement itself as a reason to leave.

Avoid: promising that the incentive selects only knowledgeable jurors, or attributing compulsory participation and conflict rules to a funded round without an approved specification.

## 10. "By round three everyone knows the room."

Sealing hides the current scores until opening. It does not hide the roster, previous results or what participants learn about one another. Later rounds may involve calibration, conformity or both.

Concede: this six-round workshop is not six independent tests. Prior results and the facilitator's debriefs can change later expectations.

Avoid: "within a round nobody can copy", which ignores leaked proofs and knowledge of the room.

## 11. "Nobody knows research as a whole, and your anchors count fields."

The anchors encode a value judgment about breadth of reliance. Participants should apply the published tests and recuse when they cannot make a reading. A community that values criticality within a small field may choose different anchors.

Concede: short blurbs and a brief scoring window provide thin evidence. The policy cannot give a juror knowledge they do not have.

Avoid: treating the anchors as facts about what a fund ought to value.

## 12. "Output agreement has uninformative equilibria, and the known fixes reward the opposite."

Output agreement is a relevant comparison: agreement can reflect common knowledge or shared bias rather than careful private information. That literature does not prove truthfulness for this ledger. Our proposed focal point is the public policy; the expectation that others follow it is the design argument to examine.

Concede: neither a tight band nor a profitable reading establishes that the incentives improved judgment. The paper reduces the total base reward for low-dispersion rounds as one deterrent to lazy agreement. Today's workshop keeps that reward full and fixed, so it does not exercise that deterrent. The individual relative-distance reward rule is shared with the paper, including stake-proportional sharing when all scores are identical.

Avoid: importing a truthful-equilibrium result from another mechanism or presenting Keynes, Schelling and output agreement as interchangeable theories.

## 13. "This is a Delphi round with a penalty and no reasons."

Delphi is a useful comparison; this design adds explicit stakes, coherence payments and sealed scoring. The question is whether those choices help the process you need. Existing facilitated methods remain possible comparators.

Concede: the workshop uses a facilitator and leaves reasons to discussion. We have not shown that payments outperform facilitated deliberation or published criteria alone.

Avoid: claiming that Delphi cannot work among strangers or has no incentive for care.

## 14. "Funders already use lotteries."

A lottery can complement a jury score, for example if a fund chooses a score threshold for eligibility. The threshold and allocation rule remain policy choices. The workshop supplies judgments under one policy; it does not establish which funding rule is best.

Concede: a lottery may answer a fund's problem without these coherence incentives.

Avoid: treating every existing funding process as unreproducible.

## 15. "This is Kleros."

Kleros and SchellingCoin are relevant antecedents; this workshop uses continuous scores and a band derived from the jury's spread. The shared concern is that anticipating agreement can reward a biased centre.

Concede: sealing is not a distinctive answer to collusion by itself. The workshop cannot establish that this design resolves the antecedents' failure modes.

Avoid: "ours is sealed" or unsupported claims about funded-round arrangements.

## 16. "Hashes and Bitcoin seed words on your own server."

Today participants trust the hosted service to enforce the protocol. The browser stores a score and its salt; the service accepts a matching reveal and the clients derive the ledger from the published records. These checks do not remove trust in the service operator. The score and salt words form a proof; the words are not a wallet recovery phrase.

Concede: this is a hosted workshop demonstration, not a deployment that removes operator trust. A future deployment must state its own trust assumptions.

Avoid: "sealing protects you from the operator" or "it is not crypto."

## 17. "What result today would have counted against the design?"

Before scoring, predict that PDF's band will be wider than both Inkscape's and Linux's. If it is not, that comparative prediction fails. The scores alone do not tell us whether a prompt failed, jurors lacked evidence or participants shared a reading we did not expect. Hear their reasons and compare them with what the ledger rewarded.

Concede: points, one room, familiar nominees and my blurbs demonstrate arithmetic and failure modes. They do not establish that the incentives improve judgment.

Avoid: inferring herding from a narrow band or calling every possible result support for the thesis.

## 18. "Project communities will stake to sit on their own juries."

Stake does not establish independence or remove conflicts of interest. In the open design, interested parties can gain weight. The full deterrents are commit and reveal, anti-prereveal games and appeals; they do not turn agreement into evidence of impartiality. Use only the approved follow-up announcement on slide 14 when describing the funded round.

Concede: aligned interests can produce a tight band around a biased centre without active collusion. The ledger cannot distinguish that from an informed agreement.

Avoid: claiming that the paper specifies an invited jury, excludes every conflict before seating or proves a safe collusion threshold.

## 19. "Appeals cannot fix a shared bias."

A larger jury can change a result, but it can share the same bias. The paper's conditional argument depends on adding distinct curators and limiting concentration of stake; more seats held by one curator still produce one reading. An appeal also has costs and can fail.

Concede: escalation is not a guarantee of correction. We discuss appeals and do not perform them today.

Avoid: "appeals fix capture by a small bloc" without its assumptions.

## 20. "A sleeping phone is a total loss."

The cutoff is pressing "Grade", not the moment a phone sleeps. A phone waking before that cutoff can open its stored seal automatically. Afterwards, its reveal is recorded but does not count. A non-recused seated juror without a timely reveal loses the stake when at least one score opens; if nobody opens a score, the round is void with no absence forfeits.

Concede: device availability matters in this workshop. The host announces the cutoff and allows recovery within the processing allowance. Deployment choices for real capital need their own specification.

Avoid: promising days-long reveal windows, sponsored capital or automatic future reveals as settled parts of the paper.

## 21. "What is 0.43 in euros, and the committee still decides."

The workshop produces a score, not a price or a funding share. If a fund chooses proportional allocation, a nominee's share is its score divided by the sum of the docket's scores. Choosing that allocation rule is a separate policy decision; it also needs a rule for a docket whose scores sum to zero. The jury does not determine the budget or establish the value of another euro of funding.

Concede: a fund already able to publish criteria and arithmetic may need no replacement. Assess whether this particular scoring and incentive process serves its purpose.

Avoid: calling a raw score a share or claiming that the committee's authority disappears.

## 22. "Your deck, handout, guide and game disagree."

Check the precise claim against the policy in `public/domain.js`, the ledger in `public/core.js` and the session facts in `public/session.js`. A historical simulation is not a promise about the current room. If the current materials disagree, acknowledge the discrepancy and use the observed result rather than defending the wording.

Concede: "credible consensus" needs its limit stated every time it matters: public and reproducible, not guaranteed true.

Avoid: saying that every discrepancy is already fixed without checking it.
