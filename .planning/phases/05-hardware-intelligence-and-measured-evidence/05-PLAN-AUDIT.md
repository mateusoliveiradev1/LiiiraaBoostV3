# Phase 5 Plan Source Audit

## Goal Coverage

| Source outcome                         | Covering plans             |
| -------------------------------------- | -------------------------- |
| Real read-only Windows inventory       | 01, 03, 07, 08, 09, 10     |
| Bounded measured evidence              | 01, 02, 05, 07, 08, 09, 10 |
| Fail-closed policy and comparison      | 04, 06, 08, 09, 10         |
| Inspectable consistent offline reports | 06, 08, 09, 10             |

## Requirement Coverage

| Requirement | Plans                          |
| ----------- | ------------------------------ |
| DIAG-01     | 01, 03, 07, 08, 09, 10         |
| DIAG-02     | 01, 03, 04, 09, 10             |
| DIAG-03     | 04, 08, 09, 10                 |
| DIAG-04     | 04, 08, 09, 10                 |
| DIAG-05     | 01, 02, 04, 06, 08, 09, 10     |
| DIAG-06     | 04, 08, 09, 10                 |
| DIAG-07     | 03, 05, 07, 10                 |
| MEAS-01     | 01, 02, 05, 07, 08, 09, 10     |
| MEAS-02     | 01, 05, 07, 08, 09, 10         |
| MEAS-03     | 01, 02, 04, 06, 08, 09, 10     |
| MEAS-04     | 01, 02, 04, 05, 06, 08, 09, 10 |
| MEAS-05     | 01, 02, 06, 08, 09, 10         |
| MEAS-06     | 01, 02, 04, 06, 08, 09, 10     |

## Decision Coverage

| Decisions  | Plans          |
| ---------- | -------------- |
| D-01..D-03 | 03, 07, 10     |
| D-04..D-06 | 02, 06, 10     |
| D-07..D-10 | 05, 09, 10     |
| D-11..D-13 | 08, 09, 10     |
| D-14..D-16 | 06, 08, 09, 10 |
| D-17..D-19 | 10             |

## Research Coverage

Contracts and trust boundaries are covered by 01/03/07; SQLite integrity by 02; pure policy engines by 04/06; PDH/ETW/QPC scheduling by 05; desktop authority transition by 07/08/09; and deterministic plus physical validation by 10. No deferred Phase 6-10 mutation, catalog, launcher automation, cloud AI, or release-distribution work is included.
