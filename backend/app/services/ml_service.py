import pickle
import os
from typing import List, Dict, Any, Optional
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from xgboost import XGBRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
import pandas as pd
import numpy as np

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "trained_models")


class MLService:
    MODEL_CLASSES = {
        "linear_regression": LinearRegression,
        "random_forest": RandomForestRegressor,
        "xgboost": XGBRegressor,
    }

    def __init__(self):
        os.makedirs(MODELS_DIR, exist_ok=True)

    def train_model(
        self,
        model_type: str,
        features: List[str],
        target: str,
        data: List[Dict],
        test_size: float = 0.2,
    ) -> Dict[str, Any]:
        df = pd.DataFrame(data)

        # Prepare features - only use numeric columns from selected features
        X = df[features].copy()
        for col in X.columns:
            if not pd.api.types.is_numeric_dtype(X[col]):
                # Try to convert to numeric, coerce errors to NaN
                X[col] = pd.to_numeric(X[col], errors="coerce")

        y = df[target].copy()
        if not pd.api.types.is_numeric_dtype(y):
            y = pd.to_numeric(y, errors="coerce")

        # Handle missing values
        X = X.fillna(X.mean())
        y = y.fillna(y.mean())

        # Drop any remaining NaN rows
        valid_mask = ~(X.isna().any(axis=1) | y.isna())
        X = X[valid_mask]
        y = y[valid_mask]

        if len(X) < 10:
            raise ValueError("Not enough valid data rows for training (need at least 10)")

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42
        )

        # Train model
        model_class = self.MODEL_CLASSES.get(model_type)
        if not model_class:
            raise ValueError(f"Unknown model type: {model_type}")

        if model_type == "xgboost":
            model = model_class(n_estimators=100, max_depth=6, random_state=42)
        elif model_type == "random_forest":
            model = model_class(n_estimators=100, max_depth=10, random_state=42)
        else:
            model = model_class()

        model.fit(X_train, y_train)

        # Evaluate
        y_pred = model.predict(X_test)
        metrics = {
            "r2_score": round(float(r2_score(y_test, y_pred)), 4),
            "mse": round(float(mean_squared_error(y_test, y_pred)), 4),
            "mae": round(float(mean_absolute_error(y_test, y_pred)), 4),
            "rmse": round(float(np.sqrt(mean_squared_error(y_test, y_pred))), 4),
        }

        return {
            "model": model,
            "metrics": metrics,
            "feature_names": list(X.columns),
            "target_name": target,
        }

    def save_model(self, model_id: str, model_data: Dict) -> str:
        filepath = os.path.join(MODELS_DIR, f"{model_id}.pkl")
        with open(filepath, "wb") as f:
            pickle.dump(model_data, f)
        return filepath

    def load_model(self, model_id: str) -> Optional[Dict]:
        filepath = os.path.join(MODELS_DIR, f"{model_id}.pkl")
        if os.path.exists(filepath):
            with open(filepath, "rb") as f:
                return pickle.load(f)
        return None

    def list_saved_models(self) -> List[str]:
        if os.path.exists(MODELS_DIR):
            return [f.replace(".pkl", "") for f in os.listdir(MODELS_DIR) if f.endswith(".pkl")]
        return []

    def delete_model(self, model_id: str) -> bool:
        filepath = os.path.join(MODELS_DIR, f"{model_id}.pkl")
        if os.path.exists(filepath):
            os.remove(filepath)
            return True
        return False

    def predict(self, model_id: str, input_data: List[Dict]) -> List[float]:
        model_data = self.load_model(model_id)
        if not model_data:
            raise ValueError(f"Model not found: {model_id}")

        model = model_data["model"]
        feature_names = model_data["feature_names"]

        df = pd.DataFrame(input_data)

        # Ensure we have all required features
        missing_features = set(feature_names) - set(df.columns)
        if missing_features:
            raise ValueError(f"Missing features in input data: {missing_features}")

        X = df[feature_names].copy()
        for col in X.columns:
            if not pd.api.types.is_numeric_dtype(X[col]):
                X[col] = pd.to_numeric(X[col], errors="coerce")

        X = X.fillna(0)

        predictions = model.predict(X)
        return [round(float(p), 4) for p in predictions]
