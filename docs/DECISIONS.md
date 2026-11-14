# DECISIONS

## Current implementation decisions

- **Simulation first:** use a bounded extrusion twin and synthetic labels because no authorized plant data or validated labels are present.
- **Episode-level separation:** split whole generated episodes before making temporal windows to prevent windows from the same episode leaking across partitions.
- **Train-only scaling:** fit imputation and normalization statistics on training readings and reuse them for validation, test, and inference.
- **Transparent physics proxy:** use explicit sensor-derived target equations as a consistency penalty. This is not a calibrated PDE solver or independent physical validation.
- **PINN is primary; LSTM is comparator:** the PINN drives dashboard and advisory risk; the LSTM is shown for comparison after eight readings are available.
- **Advisory-only intervention:** apply bounded changes to simulated state, never to external equipment.
- **In-memory runtime:** keep the demo small and locally runnable; persistence, multi-user isolation, and durable audit are not claimed.
- **No embedded synopsis benchmark results:** report only measurements reproduced by the current code, with synthetic-data scope clearly stated.

## Future decisions remain open

Plant-specific sensors and data rights, validated physics, model acceptance criteria, deployment topology, identity and access control, audit retention, and any safety case require stakeholder input before a field pilot.
