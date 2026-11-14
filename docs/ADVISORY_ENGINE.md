# ADVISORY_ENGINE

## Purpose and scope

The advisory engine converts the three PINN defect scores into one prioritized, bounded simulated action. It does not issue commands to a PLC, actuator, or real production equipment.

## Selection and severity

The highest of surface-cracking, warping, and thickness-variation risk selects the advisory. Risk bands are low below 0.35, moderate from 0.35 to below 0.65, and high at or above 0.65. The dashboard's weighted overall risk is separate from the defect score used to choose severity.

| Defect | Simulated target | Suggested adjustment | Duration |
|---|---|---:|---:|
| Surface cracking | Barrel temperature | -6 C (moderate/low), -10 C (high) | 180 s |
| Warping | Cooling efficiency | +0.12 (moderate/low), +0.20 (high) | 240 s |
| Thickness variation | Feed rate | -80 kg/h (moderate/low), -130 kg/h (high) | 210 s |

Actions are rate-limited, clamped to the simulator's sensor bounds, and expire after their duration. Feed-rate corrections are bounded so the simulated feed cannot fall below the normal profile's 820 kg/h. Re-applying an action for the active target does not stack it or extend its expiry.

## Feedback and verification

The simulator continues evolving after an action is applied. The API returns before/after readings for the adjusted variable, selected defect risk, and overall risk. A lower selected defect score is not a guarantee that aggregate risk falls, because other scenario signals may continue to change. Regression tests exercise advisory generation and feedback behavior.

## Safety boundary

All recommendations are illustrative hypotheses for a synthetic extrusion simulation. No operator should treat them as validated process instructions. See [LIMITATIONS.md](./LIMITATIONS.md).
