## Before you ask, assume, or re-derive anything: query the Hangar database

The facts for this project — hardware specs, connectors, rails, voltages, measured
findings, prior research — live in Postgres, **not** in the repo. `grep` will not find
them, and `src/data/hangar.ts` is a stale-by-design CI fixture that looks like an answer.

```bash
doppler run --project homelab --config dev -- npx tsx db/hangar/find.ts <term>
```

Run it the moment you catch yourself about to ask Patrick for a spec, a photo or a
measurement; about to say "presumably" or "typically" about a part; about to claim
something "isn't documented"; or about to start research that may already be a briefing.
Ask him only after `find.ts` comes back empty, and say where you looked.

What the hardware **is** → the database. What it is **doing right now** → `ssh beast-01-ts`.
What you learned → back into the database via `append_insight`, not just into `docs/`.

@AGENTS.md
