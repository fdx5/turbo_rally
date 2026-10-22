# Balance log

## 2026-10-23 - reduce vehicle speed dominance

The old speed curve (26.5-33.5 m/s) let straight-line speed compound throughout
the race while acceleration and drift provided too little compensation.
The new curve is 29.8-32.2 m/s. All players and AI use the same tuning, including
time attack; there is no player-only or rank-based vehicle speed adjustment.
Acceleration spans 3.4-1.35 s, drift charge 0.8-1.4, mini-turbo duration 0.9-1.25
times the stage duration, and rough-surface speed retention 55-90%.
Weight reduces spin/stop/launch duration by up to 20%; ordinary kart contact still
does not transfer forward momentum. Character recovery bonuses continue to stack.
The selection screen and speedometer now both display physical m/s times 3.6.

Validation: `npm run sim:vehicles -- test-results/vehicle-balance/after.json`.
20 vehicles x 16 courses x seeds 5/77/321 = 960 completed laps per version,
all with Lulu (no stat modifier), hard AI pilot, 120 Hz, actual road/branch geometry
and boost pads; no weapons, coins, contacts or catch-up. Zero falls in both versions.
Fastest-to-slowest mean lap-time spread fell from **16.33% to 4.71%**.
This measures solo driving performance, not item-race win rates.

| Vehicle | Before mean lap | After mean lap |
|---|---:|---:|
| Cybertruck | 50.16 s | 51.45 s |
| Police | 51.08 s | 51.48 s |
| Remicon | 52.70 s | 52.40 s |
| Epost | 53.69 s | 52.42 s |
| Tteokbokki | 53.73 s | 52.40 s |
| Porter | 53.75 s | 52.28 s |
| Coupang | 53.81 s | 52.56 s |
| Firetruck | 53.81 s | 52.63 s |
| Taxi | 53.81 s | 52.40 s |
| Dump | 54.05 s | 52.73 s |
| Icecream | 55.00 s | 52.71 s |
| Scooter | 55.05 s | 52.52 s |
| Ambulance | 55.17 s | 52.98 s |
| Garbage | 55.28 s | 52.99 s |
| Monster | 55.28 s | 52.99 s |
| Seoul bus | 55.29 s | 53.12 s |
| Golf cart | 56.38 s | 53.10 s |
| School bus | 56.70 s | 53.44 s |
| Yakult | 57.82 s | 53.44 s |
| Excavator | 58.35 s | 53.87 s |

Regression coverage checks opening acceleration, the remaining long-straight
advantage, drift charge/duration, rough shortcuts, heavy stun resistance and
HUD/selection consistency, in addition to all existing road and jump regressions.

## 2026-10-21 — medal & par times from AI runs (§10.1)
Hard-difficulty AI driving the player kart (coupang/momo), 3 laps, `tools/qa/tracks.mjs`.
gold = AI×1.03, silver = ×1.12, bronze = ×1.24, par = ×1.15. Lap times 39–49 s (spec 40–60 s ✓).

| track | AI total | gold | silver | bronze | par |
|---|---|---|---|---|---|
| t1 | 129.4s | 133s | 145s | 160s | 149s |
| t2 | 130.0s | 134s | 146s | 161s | 150s |
| t3 | 135.6s | 140s | 152s | 168s | 156s |
| t4 | 125.8s | 130s | 141s | 156s | 145s |
| t5 | 134.0s | 138s | 150s | 166s | 154s |
| t6 | 139.5s | 144s | 156s | 173s | 160s |
| t7 | 132.1s | 136s | 148s | 164s | 152s |
| t8 | 142.7s | 147s | 160s | 177s | 164s |
