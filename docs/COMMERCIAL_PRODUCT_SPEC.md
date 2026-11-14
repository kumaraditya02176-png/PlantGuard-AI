# COMMERCIAL_PRODUCT_SPEC

## Product concept

PlantGuard AI is a proof-of-concept for continuous-manufacturing quality monitoring. Its current demonstrator focuses on plastic extrusion and translates synthetic sensor drift into separate defect-risk signals and a prioritized operator advisory.

## Implemented in this repository

- Six simulated operating scenarios, nine sensor features, three defect-risk outputs.
- FastAPI service, Next.js dashboard, PINN-style model and LSTM comparator.
- Advisory simulation, model metrics endpoint, configurable illustrative ROI form, and sensor CSV export.
- Local Docker Compose configuration.

## Not a commercial or production release

There are no plant integrations, customer deployments, service-level commitments, regulatory certifications, validated model performance, or proven financial outcomes. The current process data and labels are synthetic. Security hardening, identity, tenant isolation, durable audit trails, monitoring, backup, update lifecycle, and operational support are not established. No automatic or direct machinery control is implemented or permitted by this demo.

## Productization gates

Before any pilot: define the target line and process boundary; obtain authorized, representative plant data; calibrate sensors and process models; validate against independently reviewed labels; complete threat modeling, safety review, operator workflow design, and deployment approval; then run a supervised, read-only shadow trial with agreed success criteria.
