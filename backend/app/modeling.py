from __future__ import annotations

from typing import Dict, List

import numpy as np
import torch
from torch import nn

from backend.app.preprocessing import FEATURE_COLUMNS, prepare_dataset


class PINNModel(nn.Module):
    def __init__(self, input_dim: int = len(FEATURE_COLUMNS), hidden_dim: int = 32):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, 3),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return torch.sigmoid(self.net(x))

    def data_loss(self, predictions: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        return nn.functional.mse_loss(predictions, targets)

    def physics_loss(self, features: torch.Tensor, predictions: torch.Tensor) -> torch.Tensor:
        temperature = features[:, 0]
        pressure = features[:, 1]
        feed_rate = features[:, 3]
        vibration = features[:, 4]
        viscosity = features[:, 5]
        thickness = features[:, 6]
        speed = features[:, 2]

        thermal_residual = predictions[:, 0] - torch.sigmoid((temperature - 80.0) / 12.0 + pressure / 100.0)
        material_residual = predictions[:, 2] - torch.sigmoid((feed_rate / torch.clamp(speed, min=1.0)) - thickness * 1.7 + vibration)
        stability_residual = predictions[:, 1] - torch.sigmoid((vibration - 1.5) + (temperature - 75.0) / 20.0 + (pressure - 50.0) / 35.0)
        residual = torch.cat([thermal_residual, material_residual, stability_residual], dim=0)
        return residual.pow(2).mean()

    def total_loss(self, features: torch.Tensor, predictions: torch.Tensor, targets: torch.Tensor, lambda_penalty: float = 0.25) -> torch.Tensor:
        return self.data_loss(predictions, targets) + lambda_penalty * self.physics_loss(features, predictions)


class LSTMBaseline(nn.Module):
    def __init__(self, input_dim: int = len(FEATURE_COLUMNS), hidden_dim: int = 24, output_dim: int = 3):
        super().__init__()
        self.lstm = nn.LSTM(input_dim, hidden_dim, batch_first=True)
        self.head = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, output_dim),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if x.dim() == 2:
            x = x.unsqueeze(1)
        lstm_out, _ = self.lstm(x)
        last_step = lstm_out[:, -1, :]
        return torch.sigmoid(self.head(last_step))


def _train_model(model: nn.Module, x_train: np.ndarray, y_train: np.ndarray, epochs: int = 12, learning_rate: float = 1e-3, use_pinn: bool = False):
    device = torch.device("cpu")
    model.to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)
    x_tensor = torch.tensor(x_train, dtype=torch.float32).to(device)
    y_tensor = torch.tensor(y_train, dtype=torch.float32).to(device)

    for _ in range(epochs):
        model.train()
        optimizer.zero_grad()
        if use_pinn:
            predictions = model(x_tensor)
            loss = model.total_loss(x_tensor, predictions, y_tensor)
        else:
            predictions = model(x_tensor)
            loss = nn.functional.mse_loss(predictions, y_tensor)
        loss.backward()
        optimizer.step()
    model.eval()
    return model


def train_pinn_model(x_train: np.ndarray, y_train: np.ndarray, epochs: int = 10):
    model = PINNModel(input_dim=x_train.shape[-1])
    return _train_model(model, x_train, y_train, epochs=epochs, learning_rate=1e-3, use_pinn=True)


def train_lstm_model(x_train: np.ndarray, y_train: np.ndarray, epochs: int = 15):
    model = LSTMBaseline(input_dim=x_train.shape[-1])
    device = torch.device("cpu")
    x_t = torch.tensor(x_train, dtype=torch.float32).to(device)
    if x_t.dim() == 2:
        x_t = x_t.unsqueeze(1)
    y_t = torch.tensor(y_train, dtype=torch.float32).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)

    for _ in range(epochs):
        model.train()
        optimizer.zero_grad()
        preds = model(x_t)
        loss = nn.functional.mse_loss(preds, y_t)
        loss.backward()
        optimizer.step()
    model.eval()
    return model


def evaluate_metrics(prediction: np.ndarray, target: np.ndarray) -> Dict[str, float]:
    prediction = np.asarray(prediction, dtype=np.float32)
    target = np.asarray(target, dtype=np.float32)
    mae = np.abs(prediction - target).mean()
    mse = np.square(prediction - target).mean()
    return {
        "mae": float(mae),
        "mse": float(mse),
        "synthetic_holdout": True,
        "label": "synthetic / simulated repository evaluation",
    }


def compute_risk_from_state(sensor: Dict[str, float], recent_trend: List[float] | None = None) -> Dict[str, float]:
    temperature = float(sensor.get("temperature_c", 75.0))
    pressure = float(sensor.get("pressure_bar", 50.0))
    feed = float(sensor.get("feed_rate_kg_h", 820.0))
    vibration = float(sensor.get("vibration_mm_s", 1.5))
    thickness = float(sensor.get("thickness_mm", 2.2))
    cooling = float(sensor.get("cooling_efficiency", 0.9))
    viscosity = float(sensor.get("viscosity_pa_s", 80.0))

    def _sigmoid(value: float) -> float:
        return 1.0 / (1.0 + np.exp(-value))

    surface_cracking = _sigmoid((temperature - 82.0) / 14.0 + (pressure - 50.0) / 20.0 + (vibration - 1.3) * 0.7)
    warping = _sigmoid((temperature - 80.0) / 16.0 + (1.0 - cooling) * 3.0 + (viscosity - 78.0) / 10.0)
    thickness_variation = _sigmoid((abs(thickness - 2.2) * 4.0) + (feed - 820.0) / 120.0 + (vibration - 1.5) * 0.8)

    overall = float(np.clip(0.4 * surface_cracking + 0.35 * warping + 0.25 * thickness_variation, 0.0, 1.0))
    trend = 0.0 if not recent_trend else float(np.mean(np.diff(recent_trend[-5:]))) if len(recent_trend) > 1 else float(recent_trend[-1])
    lead_time = max(6.0, 180.0 - (overall * 120.0) - trend * 40.0)

    return {
        "surface_cracking": float(np.clip(surface_cracking, 0.0, 1.0)),
        "warping": float(np.clip(warping, 0.0, 1.0)),
        "thickness_variation": float(np.clip(thickness_variation, 0.0, 1.0)),
        "overall_risk": float(np.clip(overall, 0.0, 1.0)),
        "risk_band": "low" if overall < 0.35 else "moderate" if overall < 0.65 else "high",
        "lead_time_estimate_s": float(lead_time),
    }


def risk_from_predictions(predictions: np.ndarray, recent_trend: List[float] | None = None) -> Dict[str, float]:
    predictions = np.asarray(predictions, dtype=np.float32)
    risk = {
        "surface_cracking": float(np.clip(predictions[0], 0.0, 1.0)),
        "warping": float(np.clip(predictions[1], 0.0, 1.0)),
        "thickness_variation": float(np.clip(predictions[2], 0.0, 1.0)),
    }
    overall = float(np.clip(0.45 * risk["surface_cracking"] + 0.3 * risk["warping"] + 0.25 * risk["thickness_variation"], 0.0, 1.0))
    trend = 0.0 if not recent_trend else float(np.mean(np.diff(recent_trend[-5:]))) if len(recent_trend) > 1 else float(recent_trend[-1])
    lead_time = max(8.0, 200.0 - overall * 130.0 - trend * 30.0)
    risk["overall_risk"] = overall
    risk["risk_band"] = "low" if overall < 0.35 else "moderate" if overall < 0.65 else "high"
    risk["lead_time_estimate_s"] = float(lead_time)
    return risk


def prepare_for_inference(dataset: Dict[str, np.ndarray]):
    x_train = dataset["x_train"]
    y_train = dataset["y_train"]
    pin_model = train_pinn_model(x_train, y_train, epochs=8)
    lstm = train_lstm_model(dataset["x_train_windows"], dataset["y_train_windows"], epochs=8)
    return {"pinn": pin_model, "lstm": lstm}


def build_default_models():
    dataset = prepare_dataset(window_size=8)
    return prepare_for_inference(dataset)
