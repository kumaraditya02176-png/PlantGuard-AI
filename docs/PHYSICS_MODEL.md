# PHYSICS_MODEL

## Implemented proxy relationships

For each sensor snapshot, the simulator-derived target vector uses logistic transforms (`sigmoid(z) = 1 / (1 + exp(-z))`):

```text
surface_cracking =
  sigmoid((temperature_c - 82) / 14
        + (pressure_bar - 50) / 20
        + (vibration_mm_s - 1.3) * 0.7)

warping =
  sigmoid((temperature_c - 80) / 16
        + (1 - cooling_efficiency) * 3
        + (viscosity_pa_s - 78) / 10)

thickness_variation =
  sigmoid(abs(thickness_mm - 2.2) * 4
        + (feed_rate_kg_h - 820) / 120
        + (vibration_mm_s - 1.5) * 0.8)
```

The PINN compares its predictions with these same formulas as a physics-proxy loss, in raw sensor units. Inputs to the neural prediction path are normalized using statistics fit on training data.

## Important distinction from the academic proposal

The academic synopsis describes embedding governing heat-transfer, mass-conservation, and stress-strain relationships. This implementation does **not** implement those calibrated equations or an independently verified physical model. The expressions above are transparent heuristic risk proxies chosen for the simulator and label generator. The physics loss therefore encourages consistency with synthetic labels; it does not demonstrate generalization to unseen plant physics.
