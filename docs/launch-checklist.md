# ByteList Launch Checklist

- Serve app from a local static server (not `file://`) so module imports and fetch work.
- Verify seed load on first run and persistent state on refresh.
- Run phase checklists in `docs/test-checklists/phase0.md` to `phase4.md`.
- Confirm rating validation enforces integer `1-10`.
- Confirm merged badge catalog only (no duplicate legacy badge names).
- Confirm moderation flag flow stores reports and hidden orders stay excluded.
- Clear local storage and re-test bootstrap.
- Perform final smoke test on:
  - `index.html`
  - `restaurants.html`
  - `restaurant.html`
  - `add-order.html`
  - `leaderboard.html`
  - `profile.html`
  - `survey.html`
