# Contractor testing brief — [Tool Name]

Send this to the contractor before testing begins. It sets expectations and doubles as the
skeleton they fill in to produce the intake JSON. Every section here maps directly to a field in
`scripts/lib/intake-schema.mjs` — filling this out completely means the intake JSON is nearly a
transcription exercise, not a second research task.

Copy this file, rename it for the engagement, and fill in the bracketed sections together with
the contractor before testing starts.

---

## 1. Assignment

- **Tool to test:** [tool id from `src/content/tools/tools.json`, e.g. `n8n`]
- **Plan to test on:** [specific paid/free/trial plan — be exact, e.g. "Starter, $20/mo billed
  annually" not just "paid plan"]
- **Testing window:** [start date] to [end date]
- **Minimum hours expected:** [number] — log actual hours as you go; do not estimate at the end
- **Budget for any paid subscription/server costs:** [amount, and who is reimbursing it]

## 2. Tester information

- **Full name:** [tester fills in]
- **Do you authorize StackPipeline to publish your name and role on the published review?**
  [Yes / No — if No, the review will attribute the work to "an independent contractor
  following the StackPipeline testing protocol" and your name will not appear anywhere in the
  public site or its structured data]
- **Your role / how you'd describe yourself:** [e.g. "Freelance RevOps consultant"]
- **Relevant experience with this category of tool:** [one or two real sentences — what you've
  actually built or supported, not a resume]

## 3. What to test

List the specific workflows you will build and run. Vague workflows produce vague findings —
be concrete about trigger, steps and destination.

- Workflow 1: [e.g. "Webhook receives a form submission, enriches it via HTTP request, writes
  to a CRM"]
- Workflow 2: [...]
- Workflow 3 (optional): [...]

## 4. Methodology

Describe **before you start** how you will test, so the plan and the eventual report match:

- How will you measure reliability (e.g. run each workflow N times over the test window and log
  failures)?
- Will you deliberately test failure modes (bad input, downstream timeout, rate limiting)?
- How will you evaluate the API/integrations beyond the UI?
- How will you test support (submit a real ticket? use live chat? rely only on docs)?

## 5. What to record as you go (do this daily, not from memory at the end)

- **Quantitative findings** — anything you can put a number on: run times, failure counts,
  match rates, response times, credit/execution consumption.
- **Advantages** — specific, not generic. "Handled a 10-branch conditional without a code step"
  beats "easy to use."
- **Limitations** — same standard: specific and falsifiable.
- **Reliability issues** — every failure, timeout, or silent stop you observe, with rough date
  and what you were doing when it happened.
- **Support interactions** — every ticket, chat or forum post you make: what you asked, how
  long the response took, whether it resolved the issue.
- **Pricing** — the vendor's own pricing page URL and the date you checked it. Do not rely on a
  cached number from memory or a review-aggregator site.
- **Screenshots/evidence** — capture into a `private-evidence/<tool-id>/<date>/` folder as you
  go (see `docs/review-production/evidence-sanitization.md` for what happens next — do not send
  raw screenshots directly for publication).

## 6. Comparisons

- **Which other tools have you personally used enough to compare against?**
  [list tool ids — only list tools you have actually used, not ones you've merely read about]

## 7. Disclosures

- **Do you have any conflict of interest regarding this vendor?** (e.g. employment, equity,
  a prior consulting relationship, a personal referral code you use elsewhere)
  [describe, or write "None."]
- **Certification:** By submitting the completed intake JSON, you certify that every claim,
  measurement and quote in it reflects what you actually observed during the stated testing
  period, and that you have not copied vendor marketing language, another review, or AI-generated
  text into any evidence or finding field.

## 8. Deliverable

Complete `docs/review-production/example-intake.sample.json` as a template (fill in your real
data — do not leave the sample's fictional values), validate it locally if you have Node
available (`npm run review:intake -- --file your-intake.json --out /tmp/preview.mdx` is safe to
run without touching the real content directory), and send the completed JSON plus the sanitized
evidence folder back to your StackPipeline contact.
