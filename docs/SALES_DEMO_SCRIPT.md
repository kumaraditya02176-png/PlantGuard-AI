# SALES_DEMO_SCRIPT

## Suggested 5-minute walkthrough

1. **Set expectations:** explain that this is a synthetic, local proof-of-concept; it is not connected to a factory and cannot control machinery.
2. **Show the baseline:** open the dashboard and point out sensor history, defect-specific risks, weighted overall risk, and the separate LSTM comparator.
3. **Create a scenario:** use the simulation lab to select overheating or another scenario and advance the simulator. Explain that signals and labels are generated, not measured.
4. **Review the advisory:** show the highest-ranked defect, severity band, suggested target, bounded change, and duration. Describe it as a simulation-only suggestion.
5. **Simulate feedback:** apply the correction, then compare the target sensor, defect score, and overall score before and after. Avoid promising that total risk always improves.
6. **Explain model evidence:** show synthetic holdout MAE/MSE, sample counts, and limitations; do not call them plant accuracy.
7. **Show ROI carefully:** enter stakeholder assumptions and review net annual savings, scrap-rate change in percentage points, and simple payback. Emphasize these are arithmetic estimates, not achieved results.
8. **Close with next steps:** discuss data access, independent labeling, a prospective read-only trial, and safety/security approval.

Never present synopsis/presentation figures as reproduced by this software or claim a customer, deployment, avoided defect, or guaranteed savings.
