from __future__ import annotations

from typing import Any, Dict, List

import numpy as np
import torch
from torch import nn

from backend.app.preprocessing import FEATURE_COLUMNS, prepare_dataset, synthetic_risk_target

RISK_BAND_THRESHOLDS = {"low": 0.35, "moderate": 0.65}
PINN_TRAINING_EPOCHS = 800
LSTM_TRAINING_EPOCHS = 100


def risk_band_for_value(value: float) -> str:
    if value < RISK_BAND_THRESHOLDS["low"]:
        return "low"
    if value < RISK_BAND_THRESHOLDS["moderate"]:
        return "moderate"
    return "high"


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
        targets = self.physics_targets(features)
        return nn.functional.mse_loss(predictions, targets)

    def physics_targets(self, features: torch.Tensor) -> torch.Tensor:
        temperature = features[:, 0]
        pressure = features[:, 1]
        feed_rate = features[:, 3]
        vibration = features[:, 4]
        viscosity = features[:, 5]
        thickness = features[:, 6]
        cooling = features[:, 8]
        surface_cracking = torch.sigmoid(
            (temperature - 82.0) / 14.0
            + (pressure - 50.0) / 20.0
            + (vibration - 1.3) * 0.7
        )
        warping = torch.sigmoid(
            (temperature - 80.0) / 16.0
            + (1.0 - cooling) * 3.0
            + (viscosity - 78.0) / 10.0
        )
        thickness_variation = torch.sigmoid(
            torch.abs(thickness - 2.2) * 4.0
            + (feed_rate - 820.0) / 120.0
            + (vibration - 1.5) * 0.8
        )
        return torch.stack((surface_cracking, warping, thickness_variation), dim=1)

    def total_loss(
        self,
        physical_features: torch.Tensor,
        predictions: torch.Tensor,
        targets: torch.Tensor,
        lambda_penalty: float = 0.25,
    ) -> torch.Tensor:
        return self.data_loss(predictions, targets) + lambda_penalty * self.physics_loss(physical_features, predictions)


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
        if x.dim() != 3 or x.size(1) < 1:
            raise ValueError("LSTM input must have shape (batch, time, features).")
        lstm_out, _ = self.lstm(x)
        last_step = lstm_out[:, -1, :]
        return torch.sigmoid(self.head(last_step))


def _train_model(
    model: nn.Module,
    x_train: np.ndarray,
    y_train: np.ndarray,
    epochs: int = 12,
    learning_rate: float = 1e-3,
    use_pinn: bool = False,
    physical_features: np.ndarray | None = None,
):
    device = torch.device("cpu")
    model.to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)
    x_tensor = torch.tensor(x_train, dtype=torch.float32).to(device)
    y_tensor = torch.tensor(y_train, dtype=torch.float32).to(device)
    if use_pinn and physical_features is None:
        raise ValueError("PINN training requires raw physical features for its physics loss.")
    physical_tensor = (
        torch.tensor(physical_features, dtype=torch.float32).to(device)
        if physical_features is not None
        else x_tensor
    )
    if physical_tensor.shape != x_tensor.shape:
        raise ValueError("Physical and normalized PINN training features must have matching shapes.")

    for _ in range(epochs):
        model.train()
        optimizer.zero_grad()
        if use_pinn:
            predictions = model(x_tensor)
            loss = model.total_loss(physical_tensor, predictions, y_tensor)
        else:
            predictions = model(x_tensor)
            loss = nn.functional.mse_loss(predictions, y_tensor)
        loss.backward()
        optimizer.step()
    model.eval()
    return model


def train_pinn_model(
    x_train: np.ndarray,
    y_train: np.ndarray,
    physical_features: np.ndarray,
    epochs: int = 10,
):
    model = PINNModel(input_dim=x_train.shape[-1])
    return _train_model(
        model,
        x_train,
        y_train,
        epochs=epochs,
        learning_rate=1e-3,
        use_pinn=True,
        physical_features=physical_features,
    )


def train_lstm_model(x_train: np.ndarray, y_train: np.ndarray, epochs: int = 15):
    if x_train.ndim != 3 or x_train.shape[1] < 1:
        raise ValueError("LSTM training input must contain temporal windows with shape (samples, time, features).")
    if len(x_train) != len(y_train):
        raise ValueError("LSTM input windows and labels must have the same sample count.")
    model = LSTMBaseline(input_dim=x_train.shape[-1])
    device = torch.device("cpu")
    x_t = torch.tensor(x_train, dtype=torch.float32).to(device)
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


def evaluate_metrics(prediction: np.ndarray, target: np.ndarray) -> Dict[str, Any]:
    prediction = np.asarray(prediction, dtype=np.float32)
    target = np.asarray(target, dtype=np.float32)
    if prediction.shape != target.shape or prediction.ndim != 2 or prediction.shape[1] != 3:
        raise ValueError("Predictions and targets must have matching (samples, 3) shapes.")
    mae = np.abs(prediction - target).mean()
    mse = np.square(prediction - target).mean()
    return {
        "mae": float(mae),
        "mse": float(mse),
        "sample_count": int(len(target)),
        "synthetic_holdout": True,
        "scope": "synthetic_simulator_holdout",
    }


def compute_risk_from_state(sensor: Dict[str, float], recent_trend: List[float] | None = None) -> Dict[str, float]:
    targets = synthetic_risk_target(sensor)
    surface_cracking, warping, thickness_variation = (float(value) for value in targets)
    overall = float(np.clip(0.4 * surface_cracking + 0.35 * warping + 0.25 * thickness_variation, 0.0, 1.0))
    trend = 0.0 if not recent_trend else float(np.mean(np.diff(recent_trend[-5:]))) if len(recent_trend) > 1 else float(recent_trend[-1])
    lead_time = max(6.0, 180.0 - (overall * 120.0) - trend * 40.0)

    return {
        "surface_cracking": float(np.clip(surface_cracking, 0.0, 1.0)),
        "warping": float(np.clip(warping, 0.0, 1.0)),
        "thickness_variation": float(np.clip(thickness_variation, 0.0, 1.0)),
        "overall_risk": float(np.clip(overall, 0.0, 1.0)),
        "risk_band": risk_band_for_value(overall),
        "lead_time_estimate_s": float(lead_time),
    }


def risk_from_predictions(predictions: np.ndarray, recent_trend: List[float] | None = None) -> Dict[str, float]:
    predictions = np.asarray(predictions, dtype=np.float32)
    if predictions.shape != (3,) or not np.isfinite(predictions).all():
        raise ValueError("Risk predictions must contain three finite values.")
    risk = {
        "surface_cracking": float(np.clip(predictions[0], 0.0, 1.0)),
        "warping": float(np.clip(predictions[1], 0.0, 1.0)),
        "thickness_variation": float(np.clip(predictions[2], 0.0, 1.0)),
    }
    overall = float(np.clip(0.4 * risk["surface_cracking"] + 0.35 * risk["warping"] + 0.25 * risk["thickness_variation"], 0.0, 1.0))
    trend = 0.0 if not recent_trend else float(np.mean(np.diff(recent_trend[-5:]))) if len(recent_trend) > 1 else float(recent_trend[-1])
    lead_time = max(8.0, 200.0 - overall * 130.0 - trend * 30.0)
    risk["overall_risk"] = overall
    risk["risk_band"] = risk_band_for_value(overall)
    risk["lead_time_estimate_s"] = float(lead_time)
    return risk


def prepare_for_inference(dataset: Dict[str, np.ndarray]):
    x_train = dataset["x_train"]
    y_train = dataset["y_train"]
    pin_model = train_pinn_model(
        x_train,
        y_train,
        epochs=PINN_TRAINING_EPOCHS,
        physical_features=dataset["raw_x_train"],
    )
    lstm = train_lstm_model(
        dataset["x_train_windows"],
        dataset["y_train_windows"],
        epochs=LSTM_TRAINING_EPOCHS,
    )
    return {"pinn": pin_model, "lstm": lstm}


def build_default_models():
    dataset = prepare_dataset(window_size=8)
    return prepare_for_inference(dataset)
