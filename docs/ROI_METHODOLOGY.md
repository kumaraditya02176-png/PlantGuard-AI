# ROI_METHODOLOGY

## Inputs

The dashboard calculator asks for annual throughput (kg), current scrap rate (%), assumed **relative** scrap reduction (%), material cost per kg (USD), annual operating cost (USD), and one-time implementation cost (USD). All are user-provided assumptions. Rates are constrained by the form to 0-100%; costs and throughput must be non-negative.

## Arithmetic

```text
avoided scrap material value / year =
    throughput * current_scrap_rate * assumed_relative_reduction * material_cost

net annual savings =
    avoided scrap material value - annual operating cost

scrap-rate reduction (percentage points) =
    current_scrap_rate (%) * assumed_relative_reduction

simple payback (months) =
    one_time_implementation_cost / net_annual_savings * 12
```

Payback is shown as not reached when net annual savings are zero or negative. The UI labels the calculated result as an estimate; it is not tied to a measured model effect or customer outcome.

## Exclusions

This simplified calculation omits downtime, labor, energy, product mix, taxes, financing, ramp-up, uncertainty, integration lifecycle, and any verified causal link between model advisories and scrap reduction. The assumed improvement is not a model prediction. Outputs are not a quote, forecast, or guaranteed return.
