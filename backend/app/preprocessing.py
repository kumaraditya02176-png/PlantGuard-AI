from __future__ import annotations

from typing import Dict, List, Tuple

import numpy as np

from backend.app.simulator import ExtrusionSimulator


SCENARIO_ORDER = [
    "normal",
    "overheating",
    "uneven_cooling",
    "feed_rate_instability",
    "gradual_drift",
    "sudden_disturbance",
]

FEATURE_COLUMNS = [
    "temperature_c",
    "pressure_bar",
    "screw_speed_rpm",
    "feed_rate_kg_h",
    "vibration_mm_s",
    "viscosity_pa_s",
    "thickness_mm",
    "line_speed_m_min",
    "cooling_efficiency",
]


def scenario_target_vector(scenario: str) -> np.ndarray:
    targets = {
        "normal": np.array([0.08, 0.07, 0.05], dtype=np.float32),
        "overheating": np.array([0.82, 0.46, 0.24], dtype=np.float32),
        "uneven_cooling": np.array([0.71, 0.57, 0.39], dtype=np.float32),
        "feed_rate_instability": np.array([0.62, 0.52, 0.68], dtype=np.float32),
        "gradual_drift": np.array([0.48, 0.61, 0.58], dtype=np.float32),
        "sudden_disturbance": np.array([0.88, 0.74, 0.66], dtype=np.float32),
    }
    return targets.get(scenario, targets["normal"]).astype(np.float32)


def generate_synthetic_dataset(num_samples: int = 400, window_size: int = 12) -> Tuple[np.ndarray, np.ndarray, List[str]]:
    rows: List[Dict[str, float]] = []
    labels: List[np.ndarray] = []

    for idx in range(num_samples):
        scenario = SCENARIO_ORDER[idx % len(SCENARIO_ORDER)]
        sim = ExtrusionSimulator(scenario=scenario)
        sim.reset(scenario)
        for _ in range(window_size):
            sensor = sim.advance(1.0)
            row = {"scenario": scenario}
            for name in FEATURE_COLUMNS:
                row[name] = float(sensor["sensor"][name])
            rows.append(row)
            labels.append(scenario_target_vector(scenario))

    features = np.array([[row[col] for col in FEATURE_COLUMNS] for row in rows], dtype=np.float32)
    targets = np.array(labels, dtype=np.float32)
    return features, targets, FEATURE_COLUMNS


def chronological_split(features: np.ndarray, targets: np.ndarray, val_ratio: float = 0.2, test_ratio: float = 0.15):
    total = len(features)
    train_end = max(1, int(total * (1.0 - val_ratio - test_ratio)))
    val_end = max(train_end + 1, int(total * (1.0 - test_ratio)))
    return (
        features[:train_end],
        targets[:train_end],
        features[train_end:val_end],
        targets[train_end:val_end],
        features[val_end:],
        targets[val_end:],
    )


def sliding_windows(features: np.ndarray, window_size: int = 12):
    if len(features) < window_size:
        raise ValueError("Feature length is shorter than the requested window size.")
    return np.stack([features[i : i + window_size] for i in range(len(features) - window_size + 1)], axis=0)


class Preprocessor:
    def __init__(self) -> None:
        self.median_: np.ndarray | None = None
        self.scale_: np.ndarray | None = None
        self.offset_: np.ndarray | None = None

    def fit(self, train_features: np.ndarray):
        train_array = np.asarray(train_features, dtype=np.float32)
        if train_array.size == 0:
            raise ValueError("Training data is empty.")
        nan_mask = np.isnan(train_array)
        if np.any(nan_mask):
            train_array = np.where(nan_mask, np.nanmedian(train_array, axis=0), train_array)
        self.median_ = np.nanmedian(train_array, axis=0)
        filled = np.where(np.isnan(train_array), self.median_, train_array)
        self.scale_ = filled.std(axis=0)
        self.scale_[self.scale_ == 0.0] = 1.0
        self.offset_ = filled.mean(axis=0)
        return self

    def transform(self, features: np.ndarray) -> np.ndarray:
        values = np.asarray(features, dtype=np.float32).copy()
        if self.median_ is None:
            raise ValueError("Preprocessor must be fit before transform.")
        values = np.where(np.isnan(values), self.median_, values)
        return (values - self.offset_) / self.scale_

    def fit_transform(self, features: np.ndarray) -> np.ndarray:
        self.fit(features)
        return self.transform(features)


def prepare_dataset(window_size: int = 12):
    features, targets, columns = generate_synthetic_dataset(num_samples=300, window_size=window_size)
    x_train, y_train, x_val, y_val, x_test, y_test = chronological_split(features, targets, val_ratio=0.2, test_ratio=0.15)

    preprocessor = Preprocessor()
    x_train_scaled = preprocessor.fit_transform(x_train)
    x_val_scaled = preprocessor.transform(x_val)
    x_test_scaled = preprocessor.transform(x_test)

    x_train_windows = sliding_windows(x_train_scaled, window_size)
    x_val_windows = sliding_windows(x_val_scaled, window_size)
    x_test_windows = sliding_windows(x_test_scaled, window_size)

    y_train_labels = y_train[window_size - 1 :]
    y_val_labels = y_val[window_size - 1 :]
    y_test_labels = y_test[window_size - 1 :]

    return {
        "columns": columns,
        "x_train": x_train_scaled,
        "y_train": y_train,
        "x_val": x_val_scaled,
        "y_val": y_val,
        "x_test": x_test_scaled,
        "y_test": y_test,
        "x_train_windows": x_train_windows,
        "y_train_windows": y_train_labels,
        "x_val_windows": x_val_windows,
        "y_val_windows": y_val_labels,
        "x_test_windows": x_test_windows,
        "y_test_windows": y_test_labels,
        "preprocessor": preprocessor,
    }
