# PILOT_PLAN

This is a proposed validation outline only. No customer, site, pilot, or deployment is claimed.

## Stage 0 — readiness and governance

Select a named process owner, line boundary, defect taxonomy, data owner, safety contact, and security reviewer. Define a read-only scope and prohibit actuator/PLC writes. Agree data rights, retention, access, incident handling, and operator responsibilities before data collection.

## Stage 1 — data and baseline

Collect authorized, representative sensor histories plus independently reviewed quality outcomes across normal operation, changeovers, and known disturbances. Document sensor units, sampling, calibration, missingness, timestamp alignment, and label uncertainty. Establish existing alarm and scrap baselines.

## Stage 2 — offline validation

Freeze a prospective split by time/production run; prevent leakage across repeated products and adjacent windows. Compare simple baselines with the model. Pre-register defect-specific metrics, calibration, lead-time measurement, false-alarm and missed-event costs, subgroup checks, and acceptance thresholds. Validate recommendations with process engineers without executing them.

## Stage 3 — supervised shadow trial

Run read-only alongside existing controls. Review every alert with operators, log disagreements and drift, and evaluate against pre-agreed criteria. Stop on unsafe recommendations, data quality failures, or unacceptable alarm burden.

## Stage 4 — deployment decision

Proceed only after independent model review, safety and cybersecurity approvals, operator training, monitoring/rollback plans, and written governance approval. Any future control integration is outside this proof-of-concept and requires a separate formal safety case.
