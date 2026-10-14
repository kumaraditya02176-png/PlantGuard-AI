from __future__ import annotations

from typing import Dict, List, Tuple

import numpy as np

from backend.app.simulator import SENSOR_BOUNDS, ExtrusionSimulator


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


def synthetic_risk_target(sensor: Dict[str, float]) -> np.ndarray:
    """Return transparent simulator-derived training targets, not empirical labels."""
    temperature = float(sensor["temperature_c"])
    pressure = float(sensor["pressure_bar"])
    feed = float(sensor["feed_rate_kg_h"])
    vibration = float(sensor["vibration_mm_s"])
    thickness = float(sensor["thickness_mm"])
    cooling = float(sensor["cooling_efficiency"])
    viscosity = float(sensor["viscosity_pa_s"])

    def sigmoid(value: float) -> float:
        return 1.0 / (1.0 + np.exp(-value))

    return np.asarray(
        [
            sigmoid((temperature - 82.0) / 14.0 + (pressure - 50.0) / 20.0 + (vibration - 1.3) * 0.7),
            sigmoid((temperature - 80.0) / 16.0 + (1.0 - cooling) * 3.0 + (viscosity - 78.0) / 10.0),
            sigmoid((abs(thickness - 2.2) * 4.0) + (feed - 820.0) / 120.0 + (vibration - 1.5) * 0.8),
        ],
        dtype=np.float32,
    )


def generate_synthetic_episodes(
    num_episodes: int = 300,
    episode_length: int = 32,
    seed: int = 42,
) -> List[Dict[str, object]]:
    if num_episodes < len(SCENARIO_ORDER) * 3:
        raise ValueError("At least three episodes per scenario are required for train/validation/test splits.")
    if episode_length < 1:
        raise ValueError("Episode length must be positive.")
    rng = np.random.default_rng(seed)
    episodes: List[Dict[str, object]] = []

    for idx in range(num_episodes):
        scenario = SCENARIO_ORDER[idx % len(SCENARIO_ORDER)]
        sim = ExtrusionSimulator(scenario=scenario)
        sim.reset(scenario)
        intervention_applied = (
            idx // len(SCENARIO_ORDER) % 2 == 1
            and scenario == "feed_rate_instability"
        )
        for name, (minimum, maximum) in SENSOR_BOUNDS.items():
            span = maximum - minimum
            variation = rng.uniform(-0.01 * span, 0.01 * span)
            sim.state[name] = float(np.clip(sim.state[name] + variation, minimum, maximum))
        if intervention_applied:
            sim.apply_advisory(
                {
                    "target_process_variable": "feed_rate_kg_h",
                    "suggested_adjustment": -130.0,
                    "duration_s": 30.0,
                }
            )

        episode_features: List[List[float]] = []
        episode_targets: List[np.ndarray] = []
        for _ in range(episode_length):
            sensor = sim.advance(1.0)
            snapshot = sensor["sensor"]
            episode_features.append([float(snapshot[name]) for name in FEATURE_COLUMNS])
            episode_targets.append(synthetic_risk_target(snapshot))
        episodes.append(
            {
                "episode_id": idx,
                "scenario": scenario,
                "intervention_applied": intervention_applied,
                "features": np.asarray(episode_features, dtype=np.float32),
                "targets": np.asarray(episode_targets, dtype=np.float32),
            }
        )
    return episodes


def generate_synthetic_dataset(
    num_samples: int = 400,
    window_size: int = 12,
    seed: int = 42,
) -> Tuple[np.ndarray, np.ndarray, List[str]]:
    episodes = generate_synthetic_episodes(num_samples, window_size, seed)
    features = np.concatenate([episode["features"] for episode in episodes], axis=0)
    targets = np.concatenate([episode["targets"] for episode in episodes], axis=0)
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


def _split_episodes(
    episodes: List[Dict[str, object]],
    val_ratio: float = 0.2,
    test_ratio: float = 0.15,
    seed: int = 42,
) -> Dict[str, List[Dict[str, object]]]:
    rng = np.random.default_rng(seed)
    groups: Dict[str, List[Dict[str, object]]] = {scenario: [] for scenario in SCENARIO_ORDER}
    for episode in episodes:
        groups[str(episode["scenario"])].append(episode)

    split = {"train": [], "val": [], "test": []}
    for scenario in SCENARIO_ORDER:
        scenario_episodes = groups[scenario].copy()
        rng.shuffle(scenario_episodes)
        count = len(scenario_episodes)
        if count < 3:
            raise ValueError(f"At least three episodes are required for scenario {scenario!r}.")
        test_count = max(1, int(round(count * test_ratio)))
        val_count = max(1, int(round(count * val_ratio)))
        if test_count + val_count >= count:
            raise ValueError(f"Ratios leave no training episodes for scenario {scenario!r}.")
        split["test"].extend(scenario_episodes[:test_count])
        split["val"].extend(scenario_episodes[test_count : test_count + val_count])
        split["train"].extend(scenario_episodes[test_count + val_count :])
    return split


def _flatten_episodes(
    episodes: List[Dict[str, object]],
) -> Tuple[np.ndarray, np.ndarray]:
    return (
        np.concatenate([episode["features"] for episode in episodes], axis=0),
        np.concatenate([episode["targets"] for episode in episodes], axis=0),
    )


def _episode_windows(
    episodes: List[Dict[str, object]],
    scaled_episodes: List[np.ndarray],
    window_size: int,
) -> Tuple[np.ndarray, np.ndarray]:
    windows = []
    labels = []
    for episode, scaled_features in zip(episodes, scaled_episodes):
        windows.append(sliding_windows(scaled_features, window_size))
        labels.append(episode["targets"][window_size - 1 :])
    return np.concatenate(windows, axis=0), np.concatenate(labels, axis=0)


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


def prepare_dataset(
    window_size: int = 12,
    episode_length: int = 32,
    num_episodes: int = 120,
):
    if episode_length < window_size:
        raise ValueError("Episode length must be at least the requested temporal window size.")
    episodes = generate_synthetic_episodes(num_episodes=num_episodes, episode_length=episode_length)
    split = _split_episodes(episodes)
    raw_x_train, y_train = _flatten_episodes(split["train"])
    raw_x_val, y_val = _flatten_episodes(split["val"])
    raw_x_test, y_test = _flatten_episodes(split["test"])

    preprocessor = Preprocessor()
    x_train = preprocessor.fit_transform(raw_x_train)
    x_val = preprocessor.transform(raw_x_val)
    x_test = preprocessor.transform(raw_x_test)
    scaled = {
        "train": [preprocessor.transform(episode["features"]) for episode in split["train"]],
        "val": [preprocessor.transform(episode["features"]) for episode in split["val"]],
        "test": [preprocessor.transform(episode["features"]) for episode in split["test"]],
    }
    x_train_windows, y_train_windows = _episode_windows(split["train"], scaled["train"], window_size)
    x_val_windows, y_val_windows = _episode_windows(split["val"], scaled["val"], window_size)
    x_test_windows, y_test_windows = _episode_windows(split["test"], scaled["test"], window_size)

    return {
        "columns": FEATURE_COLUMNS,
        "x_train": x_train,
        "y_train": y_train,
        "raw_x_train": raw_x_train,
        "x_val": x_val,
        "y_val": y_val,
        "raw_x_val": raw_x_val,
        "x_test": x_test,
        "y_test": y_test,
        "raw_x_test": raw_x_test,
        "x_train_windows": x_train_windows,
        "y_train_windows": y_train_windows,
        "x_val_windows": x_val_windows,
        "y_val_windows": y_val_windows,
        "x_test_windows": x_test_windows,
        "y_test_windows": y_test_windows,
        "preprocessor": preprocessor,
        "window_size": window_size,
        "episode_length": episode_length,
        "episode_ids": {
            split_name: [int(episode["episode_id"]) for episode in split[split_name]]
            for split_name in ("train", "val", "test")
        },
    }
