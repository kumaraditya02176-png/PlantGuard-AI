import assert from "node:assert/strict"
import { test } from "node:test"
import { industryTwinLayouts } from "../lib/industry-twin-layouts.ts"

const expected = {
  paper_pulp: {
    equipment: ["Pulp preparation tanks", "Stock refiner", "Forming machine", "Press rollers", "Drying cylinders", "paper reel"],
    sensors: ["stock_consistency_pct", "stock_flow_l_min", "headbox_pressure_kpa", "web_tension_n_m", "dryer_temperature_c", "sheet_moisture_pct", "caliper_um"],
  },
  steel_metals: {
    equipment: ["Raw slab", "Reheating furnace", "Roller conveyor", "Rolling mill stands", "cooling bank", "Coiling"],
    sensors: ["strip_speed_m_min", "furnace_temperature_c", "vibration_mm_s", "rolling_force_mn", "strip_thickness_mm", "cooling_flow_l_s"],
  },
  chemical_process: {
    equipment: ["Feed storage tanks", "Industrial reactor", "Mixing vessel", "Heat exchanger", "Transfer pumps", "Control valve manifold"],
    sensors: ["feed_flow_l_min", "ph", "reactor_temperature_c", "reactor_pressure_bar", "agitator_speed_rpm", "jacket_flow_l_min"],
  },
  food_beverage: {
    equipment: ["Raw material feeding", "Mixing tanks", "Pasteurization equipment", "Filling machines", "Packaging conveyor", "Finished-product packout"],
    sensors: ["product_flow_l_min", "product_ph", "pasteurization_temperature_c", "fill_volume_ml", "conveyor_speed_m_min"],
  },
  pharmaceutical: {
    equipment: ["Material dispensing", "Granulation equipment", "Blending machine", "Tablet compression machine", "Tablet coating equipment", "Inspection and packaging"],
    sensors: ["room_pressure_pa", "granulation_moisture_pct", "blend_speed_rpm", "tablet_press_force_kn", "tablet_weight_mg", "dryer_temperature_c"],
  },
}

for (const [industryId, requirements] of Object.entries(expected)) {
  test(`${industryId} has a distinct six-station twin with linked simulator signals`, () => {
    const layout = industryTwinLayouts[industryId]
    assert.ok(layout, "industry layout is registered")
    assert.equal(layout.stations.length, 6)
    assert.equal(new Set(layout.stations.map((station) => station.id)).size, 6)
    assert.equal(new Set(layout.stations.map((station) => station.position.join(","))).size, 6)

    const stationNames = layout.stations.map((station) => station.name.toLowerCase())
    for (const requiredName of requirements.equipment) {
      assert.ok(stationNames.some((name) => name.includes(requiredName.toLowerCase())), `missing equipment: ${requiredName}`)
    }

    const sensorKeys = new Set(layout.stations.flatMap((station) => station.sensorKeys))
    for (const sensorKey of requirements.sensors) {
      assert.ok(sensorKeys.has(sensorKey), `missing backend sensor: ${sensorKey}`)
    }
    for (const station of layout.stations) {
      assert.ok(station.description.length > 10)
      assert.ok(station.sensorKeys.length > 0)
    }
  })
}
