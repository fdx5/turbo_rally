# Expedition course layouts

All sixteen outlines are independently authored. Distances below describe the main road. Optional routes include narrow cuts, rough-surface cuts, wide bypasses and shared three-way junctions. Races and time attacks use the course lap count.

| Track | Main distance | Laps | Branches | Normal AI mean lap |
| --- | ---: | ---: | ---: | ---: |
| t1 | 4.22 km | 4 | 3 | 2:04 |
| t2 | 4.30 km | 4 | 3 | 2:18 |
| t3 | 4.65 km | 3 | 3 | 2:23 |
| t4 | 4.95 km | 3 | 4 | 2:13 |
| t5 | 5.30 km | 3 | 3 | 2:30 |
| t6 | 4.18 km | 4 | 3 | 2:06 |
| t7 | 4.82 km | 3 | 4 | 2:29 |
| t8 | 5.60 km | 3 | 4 | 2:46 |
| t9 | 4.45 km | 4 | 3 | 2:19 |
| t10 | 5.10 km | 3 | 3 | 2:26 |
| t11 | 4.57 km | 4 | 3 | 2:15 |
| t12 | 4.12 km | 4 | 3 | 2:12 |
| t13 | 5.42 km | 3 | 4 | 2:42 |
| t14 | 5.20 km | 3 | 3 | 2:47 |
| t15 | 5.00 km | 3 | 4 | 2:30 |
| t16 | 5.74 km | 3 | 4 | 2:35 |

Calibration: `npx tsx tools/course-audit.ts` runs two laps at 120 Hz for four reproducible scenarios per course: the main road, then three seeds with route selection and working pads. The mean is 2?3 minutes per lap; skilled cuts, vehicle tuning, items and traffic change individual laps. `npx tsx tools/branch-audit.ts` separately drives every branch from approach through rejoin, with its midpoint booster active.

Junction decisions include the main road and every branch sharing that entrance. Seeded, personality-weighted choices persist through long common mouths and exit onto the forward main road. Main-progress stationing stays aligned at shared mouths; spatial reacquisition handles skipped main-road detours.

Layout version 2 separates new best times and leaderboards from the retired short layouts. Existing race history, stars, purchases and unlocks remain. Replay version 4 hides incompatible ghosts. The additive database migration is idempotent.

Validation: 216 unit/integration tests; all 54 branch traversals and 128 calibration laps finish without falls; 16-course browser road/lens-clearance checks; full browser races on t1, t3, t8 and t16 verify both lap counts and CPU route use.
