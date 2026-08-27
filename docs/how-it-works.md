# How Vericore works

Written for anyone who needs to understand what this system does — a
procurement officer, an evaluator, a colleague who didn't write the code. No
technical background assumed.

---

## Where this document is ahead of the software

**Build status as of 27 August 2026.** This document describes the system as
designed. Only part of it is built.

| Built and working | Specified, not yet built |
|---|---|
| The database that stores tenders, bidders, documents, evidence and verdicts | Reading a tender document |
| The tamper-evident record of every action taken — verified against a live database, including that editing or deleting an entry is refused | Reading bidder documents |
| | Matching evidence to requirements |
| | Scoring, risk flags, reports |

Every section below that describes a check ends with a **Status** line saying
whether it runs today. Nothing here is claimed to work before it does. This
document is updated in the same commit as the feature it describes, so it never
drifts from the software.

---

## What problem this solves

A tender says who is allowed to bid. It says things like "average annual
turnover of at least ₹100 crore over the last three financial years," or "at
least one completed similar work worth ₹40 crore in the last seven years."
Those conditions are written in ordinary prose, buried in a sixty-page
document, and they are different for every tender.

Each bidder then submits a stack of PDFs — certificates, balance sheets, work
orders, declarations — and somebody has to read all of it and work out, for
every condition, whether that bidder meets it.

For one tender with fifteen conditions and five bidders, that is seventy-five
judgements, each requiring someone to find the right document, find the right
number in it, and compare. It is slow, it is easy to lose your place, and six
months later, when someone asks why a particular bidder was rejected, the
reasoning usually isn't written down anywhere.

Vericore does the finding and the comparing, and writes down the reasoning.

It does **not** decide who wins.

---

## What you put in

**The tender document.** The notice inviting tender, or the RFP. One file.

**Each bidder's documents.** You can supply these three ways, and you choose
which — the system never guesses:

- **Separate files**, each one labelled with what it is. The cleanest case.
- **Several files, unlabelled.** The system works out what each one is.
- **One combined PDF** containing everything. This is the most common real
  case: a single eighty-page bundle. The system splits it back into the
  individual documents inside it, and shows you where it thinks each one starts
  and ends so you can correct it before anything else happens.

**A few details about the tender** — the bid due date in particular, because
certificate expiry is checked against the bid due date, not against today's
date. A certificate that expires next week was perfectly valid on the day the
bid was submitted, and the system treats it that way.

---

## What you get back

**A checklist**, built from the tender's own words. Each condition appears
beside the sentence it came from, and you confirm or correct it before anything
is evaluated. This is a gate, not a suggestion — see "Who decides" below.

**A verdict for every condition, for every bidder.** Not pass or fail. There
are nine possible answers, because "we couldn't find the document" and "we
found it and it falls short" are genuinely different situations and shouldn't
look the same on screen:

| Verdict | What it means |
|---|---|
| Compliant | Evidence found, condition met, nothing contradicts it |
| Not compliant | Evidence found, and it clearly falls short |
| Partially compliant | Meets some parts of a multi-part condition |
| Missing evidence | No document was submitted that could answer this |
| Inconsistent | Evidence exists but contradicts itself or another document |
| Expired | Would have met the condition, but had lapsed by the bid due date |
| Unverified | An outside check couldn't be run, so we are not claiming it was |
| Not applicable | This condition doesn't apply to this bidder |
| Needs human review | A judgement call, or the system isn't confident enough |

**The evidence behind every verdict.** Every verdict points at a specific page
of a specific document. Click the verdict, see the page, with the exact region
the value was read from highlighted. If a verdict can't point at something, it
isn't recorded as a verdict.

Occasionally the system can read a value but can't work out exactly where on
the page it sat — a bad scan, or an unusual layout. When that happens it opens
the right page and tells you it couldn't pinpoint the value, instead of drawing
a box in the wrong place. A value it couldn't pinpoint is never allowed to
produce an automatic "compliant"; it goes to you to read yourself.

**A score, and separately, a risk level.** These answer different questions.
The score asks "how completely does this bidder meet the requirements?" The
risk level asks "how likely is this bidder to be misrepresenting itself?" A
bidder can score well and still be high risk. The score is ordinary
arithmetic — a weighted average over the verdicts — and you can recompute it by
hand from the table on screen. It is not a machine's opinion.

**A record of everything.** Every check the system ran, every verdict it
reached, and every decision you made, with your reason, in order, permanently.

---

## The checks it performs

Each check below says what it establishes, and — in the same breath — what it
cannot.

### Is this a real PAN, and does it belong to this kind of company?

An Indian PAN has a fixed shape: five letters, four digits, one letter. The
fourth letter says what kind of holder it is — `C` for a company, `P` for an
individual, `F` for a firm. So a bidder who says they are a private limited
company but submits a PAN with `P` in the fourth position has submitted
something that doesn't fit their own claim, and the system says so.

**What it can't tell you:** whether the PAN card is genuine, or whether it
belongs to the person presenting it. It only confirms the number is
well-formed and consistent with the company type claimed.

**Status:** not yet built.

### Does the GST number match the PAN?

This is the single most valuable check in the system, and it costs nothing.

A GSTIN is fifteen characters. Characters three to twelve of a GSTIN *are* the
company's PAN — that is how the number is constructed. So if a bidder submits a
PAN card and a GST certificate and the PAN embedded in the GSTIN is not the
same as the PAN on the card, one of those two documents is wrong. There is no
innocent explanation involving formatting or abbreviation. It is arithmetic on
characters, it is instant, and it catches most fabrication and copy-paste
errors.

**What it can't tell you:** whether the GST registration is currently active,
or whether returns have been filed. That requires the government's own system,
and in this version that lookup is simulated — see the last section.

**Status:** not yet built.

### Does the company's name match across its own documents?

Bidder B submits a PAN card reading "ABC Engineering Pvt Ltd" and a GST
certificate reading "ABC Engineers Private Limited." Is that the same company
with sloppy paperwork, or two different companies?

The system doesn't answer that with a yes or no. It strips away the parts that
routinely vary — capitalisation, punctuation, "Pvt Ltd" versus "Private
Limited", a leading "M/s" — then measures how similar what's left is, and shows
you the steps it took and the score it arrived at. A near-match is raised for
you to look at. It is never quietly treated as a match, and never quietly
treated as a mismatch.

For a consortium bid, this comparison happens *within* each member company's
own documents. Two different companies in a consortium having two different
names is normal, not a red flag.

**What it can't tell you:** whether two similarly-named companies are actually
related. That is a judgement, and it is left to you.

**Status:** not yet built.

### Does the bidder meet the turnover requirement?

The system reads the yearly turnover figures out of the audited accounts or the
chartered accountant's certificate, averages them over the financial years the
tender specifies, and compares that average to the threshold.

The reading is done by a language model, because financial statements come in
every possible layout. The averaging and the comparison are done in ordinary
code, because they are arithmetic, and arithmetic should not be delegated to
something that produces plausible-looking answers.

Bidder C is the interesting case: their turnover only meets the threshold if
you count their holding company's figures. Some tenders allow that, with an
undertaking and a board resolution; some don't. The system will show you the
numbers, show you whose they are, and mark it as needing your judgement. It
will not decide.

**What it can't tell you:** whether the financial statements are truthful. It
compares the figures presented against the threshold required.

**Status:** not yet built.

### Has anything expired?

Every certificate's validity date is compared against the **bid due date**, not
against today. Bidder A's case shows why this matters: one of their
certificates expires a few days after the bid due date. It was valid when they
bid. It is caught and shown to you as something to be aware of for the contract
period, not treated as a failure.

**What it can't tell you:** whether a certificate was renewed after it was
submitted. It sees what was in the bundle.

**Status:** not yet built.

### Is anything missing?

For each condition, the tender's checklist says which kinds of document could
possibly answer it. If none of those were submitted, the condition is marked
"missing evidence" and names what's absent — "No OEM authorisation letter
found," which is Bidder B's situation, rather than a bare red mark.

Missing evidence is deliberately not treated as failure. In real procurement
you are allowed to ask a bidder for a document they left out. Marking it as
failure would skip a step the rules actually give you.

**What it can't tell you:** whether the document exists and simply wasn't
uploaded. It reports what it did and didn't receive.

**Status:** not yet built.

### Do the bidder's documents agree with each other?

Beyond any single condition, the system compares the bidder's documents against
one another — names, tax numbers, addresses, dates, turnover figures quoted in
two places. Contradictions are collected in their own list, separate from the
condition-by-condition table, because a contradiction is a concern about the
whole submission rather than about one line of it.

**What it can't tell you:** which of two contradicting documents is the correct
one. It shows you both, and where each came from.

**Status:** not yet built.

### Government database checks

Whether the GST registration is live, whether the Udyam (MSME) registration is
real, whether the company exists at the Ministry of Corporate Affairs, whether
the bidder appears on any debarment list.

**In this version every one of these is simulated.** See the last section. It
is labelled as simulated everywhere it appears, including in anything you print
or export.

**Status:** not yet built.

---

## What it cannot do

Stated plainly, because these limits are real and shouldn't be discovered
during an argument about a tender.

**It cannot tell you a document is genuine.** There is no way for this system
to confirm that a PDF of a certificate was actually issued by the body named on
it. What it can do is check that a document's contents are internally
consistent, consistent with the bidder's other documents, and consistent with
what the relevant register reports. A well-made forgery that agrees with itself
will pass. Consistency is a useful bar. It is not proof of authenticity.

**It cannot evaluate price.** Vericore looks only at eligibility and technical
compliance. It does not open financial bids, does not compare prices, and does
not identify the lowest bidder.

**It cannot decide anything.** There is no function anywhere in this software
that qualifies or disqualifies a bidder. That is enforced by a test, not by
good intentions.

**It cannot read what isn't there.** If a scan is illegible, the system says it
couldn't read it and asks you to look. It does not guess a value and present
the guess as a finding.

**It cannot tell you what a condition means.** If the tender's wording is
ambiguous, the system will extract it, show you the original sentence, and let
you correct its reading. Ambiguity in a tender is resolved by the officer, and
the confirmation step exists precisely so that happens before anything is
evaluated against it.

---

## Who decides

You do. This is a design rule, not a disclaimer.

There are two points where the system stops and waits for a person, both chosen
because a mistake there would silently corrupt everything after it:

**Confirming the checklist.** After reading the tender, the system shows you
each condition it found beside the sentence it came from. You can edit any of
them. Nothing is evaluated until you confirm. If the system misread a threshold
as ₹10 crore when the tender said ₹100 crore, every verdict downstream would be
wrong, and nothing later in the process would catch it. Two minutes of your
attention removes that entire class of error.

**Confirming a split bundle.** If you uploaded one combined PDF, the system
shows you where it thinks each document inside it starts and ends, and you fix
any it got wrong before anything is read out of them.

And at the end, the decision itself. The system offers three actions —
qualify, seek clarification, disqualify — and each one requires you to type a
reason before it will proceed. Alongside them sits the system's own
suggestion, clearly marked as advisory and deliberately styled as a quotation
rather than as a button, so it never reads as a pre-selected answer.

If you disagree with a verdict, you can override it. Your override does not
erase what the system concluded. Both are stored, and both stay visible, so the
record shows what the system found *and* what you decided *and* why. That is
what makes the record useful if the decision is ever questioned.

Everything you do is written to a permanent log. That log cannot be edited or
deleted — not by the application, and not by someone with database access,
because the database itself refuses the operation. Each entry is sealed against
the one before it, so removing or altering any past entry breaks the seal on
every entry that follows and becomes visible immediately.

**Status:** the permanent log and its tamper-evidence are built and working
today. The screens described above are not yet built.

---

## What is real and what is simulated in this version

This is the honest accounting, and it is meant to be read before anyone asks.

| Real | Simulated |
|---|---|
| Uploading and storing documents | GST registration and return-filing lookup |
| Reading text out of documents, including scans | Udyam / MSME registration lookup |
| Reading the tender's conditions | PAN verification with the Income Tax Department |
| Reading facts out of bidder documents | Company records at the Ministry of Corporate Affairs |
| Every arithmetic and date comparison | DigiLocker issuer-signed document retrieval |
| Comparing the bidder's documents against each other | Startup India (DPIIT) recognition |
| The score and the risk flags | NSIC registration |
| The permanent, tamper-evident record | Blacklisting and debarment registers |

Every simulated answer is stored in its own table, in a column that cannot be
left empty. There is no way to record one of these lookups without recording
whether it was real.

**Why the right-hand column is simulated.** These government systems do not
offer open programmatic access. Some publish a web page a person can search by
hand; some require a formal partner agreement that takes weeks to obtain; some
offer nothing programmatic at all. We checked each one rather than assuming.

So each is built as a clearly separated component with a stand-in
implementation behind it. Every result one of them produces is stamped
`simulated` in the data itself, and that stamp is shown on screen and printed
in every export. There is no configuration in which a simulated result can be
displayed as though it came from a live government system.

When a check cannot be run — because a system is unreachable, or because it is
simulated and no stand-in answer exists — the verdict is "unverified," never
"not compliant." A register being unavailable must never cost a bidder their
tender.

The Udyam stand-in answers are drawn from the Ministry of MSME's genuinely
public dataset of registered units, so the demo data is real data. It is still
labelled simulated, because we are still not calling a live service, and the
label describes how the answer was obtained rather than how true it is.

**One further note on the language model.** The system uses a commercial
language model to read documents. The free tier of such services may use
submitted content to improve their models. Every document in this build is
synthetic — invented for the demo — so nothing confidential is involved. In a
real deployment this would need a paid tier with a no-training guarantee, and
that is a procurement decision, not a technical one.
