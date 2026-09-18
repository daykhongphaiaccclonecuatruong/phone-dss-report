import numpy as np
import pandas as pd


PRIORITY_KEYS = ["gaming", "camera", "battery", "display", "thin_light"]
NUMERIC_FEATURES = [
    "price_million",
    "release_year",
    "ram_gb",
    "rom_gb",
    "camera_score",
    "gaming_score",
    "battery_score",
    "display_score",
    "thin_light_score",
    "value_score",
    "balanced_score",
    "estimated_antutu",
    "main_camera_mp",
    "battery_mah",
    "refresh_rate_hz",
    "weight_g",
    "budget_mid",
    "budget_width",
    "budget_fit",
    "condition_used",
]
FEATURE_COLUMNS = (
    NUMERIC_FEATURES
    + [f"primary_{item}" for item in PRIORITY_KEYS]
    + [f"secondary_{item}" for item in PRIORITY_KEYS]
)


def _calculate_profile_score(row, priorities):
    score_mapping = {
        "camera": row.get("camera_score", 50),
        "gaming": row.get("gaming_score", 50),
        "battery": row.get("battery_score", 50),
        "display": row.get("display_score", 50),
        "thin_light": row.get("thin_light_score", 50),
    }

    if not priorities:
        priorities = ["gaming"]

    if len(priorities) == 1:
        p1 = score_mapping.get(priorities[0], row.get("balanced_score", 50))
        score = (
            p1 * 0.65
            + row.get("value_score", 50) * 0.20
            + row.get("balanced_score", 50) * 0.15
        )
    else:
        p1 = score_mapping.get(priorities[0], row.get("balanced_score", 50))
        p2 = score_mapping.get(priorities[1], row.get("balanced_score", 50))
        score = (
            p1 * 0.50
            + p2 * 0.30
            + row.get("value_score", 50) * 0.10
            + row.get("balanced_score", 50) * 0.10
        )

    return round(float(np.clip(score, 0.0, 100.0)), 2)


class PhoneSuitabilityModel:
    """
    Mô hình học máy KNN Regression đơn giản.

    Model học từ các profile nhu cầu mẫu và điểm phù hợp lịch sử/mô phỏng,
    sau đó dự đoán ml_score cho từng điện thoại theo profile người dùng hiện tại.
    """

    def __init__(self, n_neighbors=9):
        self.n_neighbors = n_neighbors
        self.feature_columns = FEATURE_COLUMNS
        self.mean_ = None
        self.std_ = None
        self.x_train_ = None
        self.y_train_ = None

    def fit(self, x_train, y_train):
        x = x_train[self.feature_columns].astype(float).to_numpy()
        y = np.asarray(y_train, dtype=float)
        self.mean_ = x.mean(axis=0)
        self.std_ = x.std(axis=0)
        self.std_[self.std_ == 0] = 1.0
        self.x_train_ = (x - self.mean_) / self.std_
        self.y_train_ = y
        return self

    def predict(self, x_test):
        if self.x_train_ is None or self.y_train_ is None:
            raise RuntimeError("Model must be fitted before predict().")

        x = x_test[self.feature_columns].astype(float).to_numpy()
        x = (x - self.mean_) / self.std_
        predictions = []

        for row in x:
            distances = np.linalg.norm(self.x_train_ - row, axis=1)
            nearest_idx = np.argsort(distances)[: self.n_neighbors]
            nearest_dist = distances[nearest_idx]
            weights = 1.0 / (nearest_dist + 1e-6)
            pred = np.average(self.y_train_[nearest_idx], weights=weights)
            predictions.append(pred)

        return np.clip(np.asarray(predictions), 0.0, 100.0)


def _safe_numeric(series, default=0.0):
    return pd.to_numeric(series, errors="coerce").fillna(default).astype(float)


def build_feature_frame(df, priorities, min_budget, max_budget, condition):
    primary = priorities[0] if priorities else "gaming"
    secondary = priorities[1] if len(priorities or []) > 1 else None
    budget_mid = (float(min_budget) + float(max_budget)) / 2.0
    budget_width = max(float(max_budget) - float(min_budget), 0.5)

    features = pd.DataFrame(index=df.index)
    features["price_million"] = _safe_numeric(df.get("price", 0)) / 1000000.0
    features["release_year"] = _safe_numeric(df.get("release_year", 2021), 2021)
    features["ram_gb"] = _safe_numeric(df.get("ram_gb", 8), 8)
    features["rom_gb"] = _safe_numeric(df.get("rom_gb", 128), 128)
    features["camera_score"] = _safe_numeric(df.get("camera_score", 50), 50)
    features["gaming_score"] = _safe_numeric(df.get("gaming_score", 50), 50)
    features["battery_score"] = _safe_numeric(df.get("battery_score", 50), 50)
    features["display_score"] = _safe_numeric(df.get("display_score", 50), 50)
    features["thin_light_score"] = _safe_numeric(df.get("thin_light_score", 50), 50)
    features["value_score"] = _safe_numeric(df.get("value_score", 50), 50)
    features["balanced_score"] = _safe_numeric(df.get("balanced_score", 50), 50)
    features["estimated_antutu"] = _safe_numeric(
        df.get("estimated_antutu", df.get("antutu_score", 300000)),
        300000,
    )
    features["main_camera_mp"] = _safe_numeric(df.get("main_camera_mp", 50), 50)
    features["battery_mah"] = _safe_numeric(df.get("battery_mah", 5000), 5000)
    features["refresh_rate_hz"] = _safe_numeric(df.get("refresh_rate_hz", 60), 60)
    features["weight_g"] = _safe_numeric(df.get("weight_g", 190), 190)
    features["budget_mid"] = budget_mid
    features["budget_width"] = budget_width
    features["budget_fit"] = 100.0 - (
        (features["price_million"] - budget_mid).abs() / budget_width * 100.0
    ).clip(0, 100)
    features["condition_used"] = 1.0 if condition == "used" else 0.0

    for item in PRIORITY_KEYS:
        features[f"primary_{item}"] = 1.0 if item == primary else 0.0
        features[f"secondary_{item}"] = 1.0 if item == secondary else 0.0

    return features[FEATURE_COLUMNS]


def _synthetic_label(row, priorities, min_budget, max_budget):
    mcda_score = _calculate_profile_score(row, priorities)
    price_million = float(row.get("price", 0) or 0) / 1000000.0
    budget_mid = (min_budget + max_budget) / 2.0
    budget_width = max(max_budget - min_budget, 0.5)
    budget_fit = 100.0 - min(abs(price_million - budget_mid) / budget_width * 100.0, 100.0)
    release_year = float(row.get("release_year", 2021) or 2021)
    recency_score = max(0.0, min((release_year - 2020.0) / 6.0 * 100.0, 100.0))
    label = mcda_score * 0.72 + budget_fit * 0.18 + recency_score * 0.10
    return round(float(np.clip(label, 0.0, 100.0)), 2)


def build_training_set(df):
    profiles = [
        (5.0, 7.0, ["battery"]),
        (7.0, 12.0, ["camera"]),
        (7.0, 15.0, ["gaming"]),
        (10.0, 15.0, ["display"]),
        (12.0, 25.0, ["camera", "battery"]),
        (5.0, 10.0, ["battery", "thin_light"]),
        (15.0, 30.0, ["gaming", "display"]),
        (8.0, 18.0, ["thin_light", "camera"]),
    ]

    feature_frames = []
    labels = []
    for min_budget, max_budget, priorities in profiles:
        x = build_feature_frame(df, priorities, min_budget, max_budget, df.get("condition", "new").iloc[0])
        y = df.apply(lambda row: _synthetic_label(row, priorities, min_budget, max_budget), axis=1)
        feature_frames.append(x)
        labels.extend(y.tolist())

    return pd.concat(feature_frames, ignore_index=True), np.asarray(labels, dtype=float)


def train_suitability_model(df):
    x_train, y_train = build_training_set(df)
    model = PhoneSuitabilityModel(n_neighbors=9)
    model.fit(x_train, y_train)
    return model


def predict_ml_scores(df, priorities, min_budget, max_budget, condition):
    if df.empty:
        return np.asarray([])
    model = train_suitability_model(df)
    x_test = build_feature_frame(df, priorities, min_budget, max_budget, condition)
    return model.predict(x_test)


def evaluate_model(df):
    x, y = build_training_set(df)
    if len(x) < 5:
        return {"mae": 0.0, "rmse": 0.0, "samples": len(x)}

    split = max(1, int(len(x) * 0.75))
    model = PhoneSuitabilityModel(n_neighbors=7)
    model.fit(x.iloc[:split], y[:split])
    pred = model.predict(x.iloc[split:])
    true = y[split:]
    mae = float(np.mean(np.abs(pred - true)))
    rmse = float(np.sqrt(np.mean((pred - true) ** 2)))
    return {"mae": round(mae, 2), "rmse": round(rmse, 2), "samples": len(x)}
