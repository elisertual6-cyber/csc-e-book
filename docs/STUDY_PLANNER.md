# Personal 30-day planner

`/study-plan` is a public, ungraded planning tool. It builds a suggested routine from the existing draft lesson catalog. It does not represent a complete curriculum, official examination timetable, prescribed preparation duration or prediction of passing. No database migration, content import, administrator bootstrap or paid access is needed to use it.

The learner selects Professional or Subprofessional, a suggested daily budget of 15, 30 or 60 minutes, and an optional start date. Each of four weeks has four topic sessions, a review session, a paper-practice session and a catch-up/rest day. With the expanded 23-lesson catalog, later topic sessions can list two drafts; learners may spread that work over additional days. Day 29 returns to difficult topics; day 30 is reflection and planning the next steps. Eligible shared and track lessons are all introduced within the topic sessions; later topic slots revisit earlier lessons rather than inventing missing material. Unwritten outline areas remain outside this schedule. Track labels follow the product's provisional curriculum, whose official coverage is unverified.

Learners choose a day, follow its lesson links and mark their own activity complete. The two tracks keep separate completion marks. A mark is self-reported planner activity, never an attempt response, score, editorial approval or proof of examination readiness. Session-minute suggestions sum to the chosen budget; catch-up days may instead be rest days. Calendar labels use date-only UTC arithmetic to avoid local daylight-saving shifts. Changing the start date moves the displayed dates without erasing completion marks.

## Browser saving and privacy

Browser persistence is optional and off by default. If enabled, the planner saves only an allowlisted version, track, minute budget, optional start date, selected day and completed-day numbers in the `csc-study-planner-v1` localStorage entry. It stores no identities, credentials, account sessions, exam questions, answer keys or response text. It does not send planner settings to an API or sync them to an account. On a shared device, leave saving off or turn it off when finished. Turning it off removes this planner entry, leaving unrelated browser storage alone; current in-memory activity remains until reload.

Restored data is treated as untrusted. Unsupported versions, tracks, budgets, dates or day numbers are rejected. Extra properties are discarded and duplicate completion numbers are normalized. Malformed or oversized saved content starts a fresh plan. Blocked or full storage produces a visible generic message while the planner and print remain usable. If browser policy prevents removal too, manage saved data using browser settings. Private browsing or clearing site data may remove a saved plan.

## Print

**Print 30-day plan** opens the browser print dialog. Print styling includes a 30-row schedule, selected track, minute budget, dates and completion marks, while hiding interactive controls and navigation. Use the browser's PDF destination if desired. This is a personal schedule, not the protected e-book PDF worker or a paid edition; no content publication or review gate is bypassed.

The planner is linked from the main navigation, homepage and the study-methods/study-plan positions in the curriculum. Those curriculum links identify an available tool, not two additional completed lesson drafts. The later practice expansion adds separate draft lesson text for these areas. Current totals are 23 public drafts and 230 editorial questions; see PRACTICE_EXPANSION.md.

## Verification

Unit checks cover all eligible topics, exclusion of the other track, session budgets, review/rest days, date arithmetic and untrusted saved settings. Browser tests cover default non-persistence, explicit opt-in, restoration, separate track marks, opting out, malformed saved data, track-specific links and the printable 30-row layout on desktop/mobile. The public-page accessibility scan includes the planner. Automated scans do not establish conformance or replace manual assistive-technology review.
