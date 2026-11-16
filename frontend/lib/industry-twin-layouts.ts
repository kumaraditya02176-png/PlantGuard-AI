export type IndustryTwinId =
  | "paper_pulp"
  | "steel_metals"
  | "chemical_process"
  | "food_beverage"
  | "pharmaceutical"

export type IndustryTwinStationDefinition = {
  id: string
  name: string
  description: string
  sensorKeys: string[]
  position: [number, number, number]
}

export type IndustryTwinLayout = {
  title: string
  stations: IndustryTwinStationDefinition[]
}

export const industryTwinLayouts: Record<IndustryTwinId, IndustryTwinLayout> = {
  paper_pulp: {
    title: "Paper & pulp manufacturing line",
    stations: [
      { id: "stock-prep", name: "Pulp preparation tanks", description: "Stock consistency and flow preparation", sensorKeys: ["stock_consistency_pct", "stock_flow_l_min"], position: [-6.2, 0, -0.65] },
      { id: "refiner", name: "Stock refiner", description: "Refining and conditioned stock transfer", sensorKeys: ["stock_consistency_pct", "stock_flow_l_min"], position: [-3.72, 0, 0.65] },
      { id: "forming", name: "Forming machine", description: "Headbox delivery and wet-web formation", sensorKeys: ["headbox_pressure_kpa", "web_tension_n_m"], position: [-1.24, 0, -0.65] },
      { id: "press", name: "Press rollers", description: "Wet-web pressing and caliper tracking", sensorKeys: ["web_tension_n_m", "caliper_um"], position: [1.24, 0, 0.65] },
      { id: "dryers", name: "Drying cylinders", description: "Thermal drying and sheet-moisture tracking", sensorKeys: ["dryer_temperature_c", "sheet_moisture_pct"], position: [3.72, 0, -0.65] },
      { id: "reel", name: "Calender and paper reel", description: "Finished-sheet caliper and winding", sensorKeys: ["caliper_um", "web_tension_n_m"], position: [6.2, 0, 0.65] },
    ],
  },
  steel_metals: {
    title: "Steel hot-rolling line",
    stations: [
      { id: "slab", name: "Raw slab entry", description: "Simulated slab entry and strip-speed signal", sensorKeys: ["strip_speed_m_min"], position: [-6.2, 0, -0.65] },
      { id: "furnace", name: "Reheating furnace", description: "Furnace temperature profile", sensorKeys: ["furnace_temperature_c"], position: [-3.72, 0, 0.65] },
      { id: "conveyor", name: "Roller conveyor", description: "Strip transport speed and vibration", sensorKeys: ["strip_speed_m_min", "vibration_mm_s"], position: [-1.24, 0, -0.65] },
      { id: "mill", name: "Rolling mill stands", description: "Rolling force and strip-thickness signals", sensorKeys: ["rolling_force_mn", "strip_thickness_mm"], position: [1.24, 0, 0.65] },
      { id: "cooling", name: "Run-out cooling bank", description: "Post-roll cooling-flow signal", sensorKeys: ["cooling_flow_l_s"], position: [3.72, 0, -0.65] },
      { id: "coiler", name: "Coiling equipment", description: "Finished-strip speed and gauge", sensorKeys: ["strip_speed_m_min", "strip_thickness_mm"], position: [6.2, 0, 0.65] },
    ],
  },
  chemical_process: {
    title: "Continuous chemical process plant",
    stations: [
      { id: "storage", name: "Feed storage tanks", description: "Simulated feed flow and composition proxy", sensorKeys: ["feed_flow_l_min", "ph"], position: [-6.2, 0, 0.65] },
      { id: "reactor", name: "Industrial reactor", description: "Reactor temperature and pressure", sensorKeys: ["reactor_temperature_c", "reactor_pressure_bar"], position: [-3.72, 0, -0.65] },
      { id: "mixer", name: "Mixing vessel", description: "Agitation and feed-composition signals", sensorKeys: ["agitator_speed_rpm", "ph"], position: [-1.24, 0, 0.65] },
      { id: "exchanger", name: "Heat exchanger", description: "Jacket flow and reactor-temperature signals", sensorKeys: ["jacket_flow_l_min", "reactor_temperature_c"], position: [1.24, 0, -0.65] },
      { id: "pump", name: "Transfer pumps", description: "Feed transfer and reactor pressure", sensorKeys: ["feed_flow_l_min", "reactor_pressure_bar"], position: [3.72, 0, 0.65] },
      { id: "valves", name: "Control valve manifold", description: "Pressure and feed-flow control signals", sensorKeys: ["reactor_pressure_bar", "feed_flow_l_min"], position: [6.2, 0, -0.65] },
    ],
  },
  food_beverage: {
    title: "Food processing and packaging line",
    stations: [
      { id: "feed", name: "Raw material feeding", description: "Product feed flow and composition proxy", sensorKeys: ["product_flow_l_min", "product_ph"], position: [-6.2, 0, 0.65] },
      { id: "mixing", name: "Mixing tanks", description: "Product transfer and acidity proxy", sensorKeys: ["product_flow_l_min", "product_ph"], position: [-3.72, 0, -0.65] },
      { id: "pasteurizer", name: "Pasteurization equipment", description: "Simulated product-temperature signal", sensorKeys: ["pasteurization_temperature_c"], position: [-1.24, 0, 0.65] },
      { id: "filler", name: "Filling machines", description: "Container fill-volume signal", sensorKeys: ["fill_volume_ml"], position: [1.24, 0, -0.65] },
      { id: "conveyor", name: "Packaging conveyor", description: "Conveyor speed and upstream flow", sensorKeys: ["conveyor_speed_m_min", "product_flow_l_min"], position: [3.72, 0, 0.65] },
      { id: "packout", name: "Finished-product packout", description: "Pack-line speed and fill-volume signals", sensorKeys: ["conveyor_speed_m_min", "fill_volume_ml"], position: [6.2, 0, -0.65] },
    ],
  },
  pharmaceutical: {
    title: "Pharmaceutical solid-dose line",
    stations: [
      { id: "dispensing", name: "Material dispensing", description: "Controlled-room pressure differential", sensorKeys: ["room_pressure_pa"], position: [-6.2, 0, 0.65] },
      { id: "granulator", name: "Granulation equipment", description: "Granulation-moisture signal", sensorKeys: ["granulation_moisture_pct"], position: [-3.72, 0, -0.65] },
      { id: "blender", name: "Blending machine", description: "Blend speed and moisture signals", sensorKeys: ["blend_speed_rpm", "granulation_moisture_pct"], position: [-1.24, 0, 0.65] },
      { id: "press", name: "Tablet compression machine", description: "Compression force and tablet weight", sensorKeys: ["tablet_press_force_kn", "tablet_weight_mg"], position: [1.24, 0, -0.65] },
      { id: "coater", name: "Tablet coating equipment", description: "Dryer temperature and granulation moisture", sensorKeys: ["dryer_temperature_c", "granulation_moisture_pct"], position: [3.72, 0, 0.65] },
      { id: "inspection", name: "Inspection and packaging", description: "Tablet-weight and controlled-room signals", sensorKeys: ["tablet_weight_mg", "room_pressure_pa"], position: [6.2, 0, -0.65] },
    ],
  },
}
