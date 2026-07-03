# Kanbedu Semester Playbook (Sep 2026 - Jan 2027)

Written 2026-07-04. This is the operating plan for turning Kanbedu from a finished product into a revenue-generating startup. Owner: Jorge. The product is in maintenance mode; everything below is business execution.

**The one-line strategy:** individual lecturers are the wrong buyer. The department is the buyer. This semester exists to gather the evidence for one department pitch, then repeat that playbook at other institutions.

**The honest math:** RM10k/month is ~10-15 department licenses, built over 2027-2028. This semester's realistic outcome is the FIRST paying deal (RM100-500/month territory). That is success, not failure.

---

## 0. Prerequisites (July-August, before semester starts)

| Task | Owner | Status |
|---|---|---|
| Open a personal bank account (any major bank, bring MyKad) | Jorge | Not done |
| Create Stripe account once bank account exists | Jorge | Not done |
| Uptime monitor (free, e.g. UptimeRobot) pinging /api/health, alerting staff Discord | Engineers | Not done |
| Verify database backups actually restore, not just that the script runs | Engineers | Not done |
| Tell W he is a Founding Educator, free for life. Remove the money awkwardness | Jorge | Not done |
| Ask W casually: who decides tool spending in the department? | Jorge | Not done |
| Decide fallback plan for GCS storage if althras sponsorship ever ends | Engineers | Not done |

SSM sole proprietor registration (EzBiz online, ~RM30-60/year): start it when the department pitch is scheduled, not before. Universities pay registered businesses with invoices.

---

## 1. When to open the paid Pro plan

Do NOT gate on the waitlist. It measures traffic to a page nobody visits, not demand.

Open individual paid Pro only when ALL three are true:

1. **Plumbing:** bank account + verified Stripe + SSM started.
2. **Free tier has an edge:** new accounts get a free limit (proposal: 2 active classes, unlimited archived). Everyone signed up before Pro launch is grandfathered unlimited forever. Never take features away from early adopters.
3. **Demand evidence, any one of:**
   - 20+ educators actively running classes, some from outside W's circle
   - 3+ lecturers who personally asked to pay or asked about limits
   - One department license signed (Pro then becomes the mop-up for lecturers whose departments won't pay)

Realistic date: around the start of semester two (Jan 2027). Not September.

Pricing direction (not final): per-semester billing (~RM79/semester) over monthly. Lecturers think in semesters and hate paying through breaks. When a semester license lapses, classes go read-only, never deleted.

---

## 2. September onboarding week

The 8-9 lecturers W trains are the entire customer base. Their first week decides everything.

- Jorge is physically present when W trains the lecturers. Answer questions live.
- Before day one: rate-limit table cleared, uptime monitor live, dev team on standby that week.
- Every lecturer leaves the training with their class already created and students imported (CSV + QR join flow).
- Any bug reported that week gets fixed within 48 hours. Speed of response IS the product experience.
- ~50 students in the cohort: invite email volume is safely under the Brevo 300/day cap. AWS SES swap is deferred, only needed when Kanbedu spreads beyond one cohort.

---

## 3. Evidence engine (all semester)

The November pitch is data, not vibes. Collect from week one:

- Number of active classes and educators, weekly
- Students actively using boards (tasks created/moved per week)
- Integrity flags surfaced (speed-runs, column skips caught) = the "you can't get this from WhatsApp" number
- Participation data lecturers actually used in grading
- 2-3 short lecturer quotes/testimonials, collected mid-semester when enthusiasm is real
- Any lecturer who says "I would pay for this" gets written down verbatim, with date

---

## 4. The department pitch (October-November)

- Target: whoever W names as the budget owner (head of department / faculty office).
- Ask W to make the introduction mid-semester, once lecturers are visibly using it.
- Bring: one-page summary + the evidence numbers + testimonials.
- Opening price: RM1,500-3,000/year for the whole department. Cheap enough to approve without a committee, real enough to count.
- What they're buying: all lecturers covered, onboarding for new staff each semester, support (you + 2 engineers), PDPA-compliant student data handling.
- If they say "no budget this year": ask what would need to be true next budget cycle, and keep the department on free. A slow yes is still a yes.

---

## 5. Referral loop (mid-semester onward)

- Every visibly happy lecturer gets asked for exactly one introduction to a colleague elsewhere.
- Each new coordinator (a "W" at another department/university) is a future department deal.
- Assets to build with AI help: 60-90 second demo video showing the Monitor panel, cold outreach template for coordinators.
- No paid ads. This product spreads through peer trust only.

---

## 6. Kill criteria (honest checkpoint, end of semester)

Reassess seriously if, by January 2027:

- Lecturers used it in September but stopped by November (retention failure, worst signal)
- No department conversation has a next step after two attempts
- No lecturer, unprompted, has ever asked about paying

If those hold, Kanbedu may be a portfolio piece and a lesson rather than the RM10k vehicle. That is allowed. The goal is RM10k/month by age 22 across attempts, not Kanbedu at all costs. What transfers to attempt #2: the shipped product, the selling reps, the network of educators.

---

## Weekly rhythm for Jorge (24-28 hrs/week budget)

- ~1 hr: check evidence numbers, note anything odd
- ~2 hr: talk to at least one lecturer (usage check-in, not sales)
- Rest: normal studies + coursework. The startup work is front-loaded in September and the pitch window in Oct-Nov.

## Division of labor

- **Jorge (only Jorge can do):** relationships, W, the pitch, pricing decisions, asking for referrals.
- **Engineers:** stability, uptime monitor, backups, 48-hour bug turnaround in September, SES swap when needed.
- **AI (any model):** demo video script, pitch one-pager, outreach templates, free-tier limit implementation when gate 1 is met, this file's upkeep.
