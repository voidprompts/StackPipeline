# Evidence sanitization process

Hands-on testing produces raw evidence: screenshots, session recordings, CSV exports, support
ticket transcripts. Some of that raw material inevitably contains information that must never be
committed to a public git repository — account identifiers, real customer data, API keys, billing
details. This document is the required process between "a contractor captured a screenshot" and
"a review links to it."

## The two directories

| Directory | Tracked in git? | Contents |
| --- | --- | --- |
| `private-evidence/` | **No** — git-ignored | Raw, unedited evidence exactly as captured |
| `public-evidence/` | **Yes** | Sanitized assets a published review may reference |

`private-evidence/` is created locally by whoever is handling the intake (contractor or editor)
and never leaves that machine except through the sanitization step below. It is listed in
`.gitignore` (`private-evidence/`, `**/private-evidence/`) so it cannot be committed by accident,
including inside a nested contractor-supplied folder structure.

## Process

1. **Capture raw evidence into `private-evidence/<tool-id>/<date>/`.** Keep the original
   resolution and full context — do not pre-crop at capture time, since you may need the extra
   context to answer an editor's question later.

2. **Review every asset for private information before it goes anywhere else.** Check for:
   - Account emails, names, usernames, avatars
   - Real customer/contact records inside CRM or table screenshots
   - API keys, tokens, webhook URLs with embedded secrets, session cookies
   - Billing information, invoice numbers, card details
   - Company names or internal URLs that identify the contractor's employer or client, unless
     that context was authorized in writing for publication

3. **Sanitize.** For each asset that will be published:
   - Crop out anything not relevant to the point being illustrated.
   - Blur or black-box any remaining identifiers you cannot crop away.
   - Replace real values with clearly fake placeholders (`jane@example.com`, `Acme Corp`) rather
     than leaving a redaction box over real text when the layout needs to stay legible.
   - Re-export as a new file — do not edit in place, so the private original is always
     recoverable if a mistake needs correcting.

4. **Save the sanitized output to `public-evidence/<tool-id>/<date>/<name>.png`** (see the
   layout convention in `public-evidence/README.md`).

5. **Reference it from the intake JSON** under `evidenceRefs`:
   ```json
   {
     "description": "Workflow editor showing a 4-branch conditional split",
     "publicPath": "n8n/2026-09-23/workflow-editor-branching.png"
   }
   ```
   `scripts/review-intake.mjs` checks that this path exists under `public-evidence/` before it
   will generate a draft, and `scripts/review-validate.mjs` re-checks it on every validation run
   — a review can never claim evidence that was never actually placed in the public directory.

6. **Delete or archive `private-evidence/`** once the sanitized assets are confirmed correct and
   the review has been through editorial approval. It is not backed up by this repository.

## What "sanitized" does not mean

Sanitization is not a substitute for consent. If a screenshot would reveal a real customer's data
even after cropping (e.g. a CRM record visible in a background window), do not publish that asset
at all — describe the finding in prose instead, cited to the testing session by date.
