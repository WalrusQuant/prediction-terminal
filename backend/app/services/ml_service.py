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

from app.services.preprocessing_service import PreprocessingService
from app.services.validation_service import ValidationService, SplitType

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
        split_type: str = "random",
        date_column: Optional[str] = None,
        n_cv_splits: int = 5,
    ) -> Dict[str, Any]:
        df = pd.DataFrame(data)

        # Prepare features DataFrame (include date_column if needed for splitting)
        feature_cols = features.copy()
        X = df[feature_cols].copy()

        # Prepare target - handle non-numeric and missing values
        y = df[target].copy()
        if not pd.api.types.is_numeric_dtype(y):
            y = pd.to_numeric(y, errors="coerce")

        # Keep date column for time-based splits if provided
        date_series = None
        if date_column and date_column in df.columns:
            date_series = df[date_column].copy()

        # Drop rows where target is NaN
        valid_mask = ~y.isna()
        X = X[valid_mask].reset_index(drop=True)
        y = y[valid_mask].reset_index(drop=True)
        if date_series is not None:
            date_series = date_series[valid_mask].reset_index(drop=True)

        if len(X) < 10:
            raise ValueError("Not enough valid data rows for training (need at least 10)")

        # Detect column types for preprocessing
        column_types = PreprocessingService.detect_column_types(X, feature_cols)

        # Handle walk-forward CV separately
        if split_type == "walk_forward" and date_column:
            return self._train_with_walk_forward(
                X, y, date_series, model_type, column_types, feature_cols, target, n_cv_splits, test_size
            )

        # Split data based on split type
        if split_type == "time_based" and date_column and date_series is not None:
            # Create temporary df with date for splitting
            temp_df = X.copy()
            temp_df['__date__'] = date_series
            temp_df['__target__'] = y

            train_df, test_df = ValidationService.time_based_split(temp_df, '__date__', test_size)

            X_train = train_df.drop(['__date__', '__target__'], axis=1)
            y_train = train_df['__target__']
            X_test = test_df.drop(['__date__', '__target__'], axis=1)
            y_test = test_df['__target__']
        else:
            # Random split (default)
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=test_size, random_state=42
            )

        # Create model instance
        model_class = self.MODEL_CLASSES.get(model_type)
        if not model_class:
            raise ValueError(f"Unknown model type: {model_type}")

        if model_type == "xgboost":
            model_instance = model_class(n_estimators=100, max_depth=6, random_state=42)
        elif model_type == "random_forest":
            model_instance = model_class(n_estimators=100, max_depth=10, random_state=42)
        else:
            model_instance = model_class()

        # Build full pipeline with preprocessing and model
        pipeline = PreprocessingService.build_full_pipeline(
            numeric_features=column_types["numeric"],
            categorical_features=column_types["categorical"],
            model=model_instance
        )

        # Fit the pipeline
        pipeline.fit(X_train, y_train)

        # Evaluate on test set
        y_pred_test = pipeline.predict(X_test)
        y_pred_train = pipeline.predict(X_train)

        # Calculate metrics
        metrics = {
            "r2_score": round(float(r2_score(y_test, y_pred_test)), 4),
            "mse": round(float(mean_squared_error(y_test, y_pred_test)), 4),
            "mae": round(float(mean_absolute_error(y_test, y_pred_test)), 4),
            "rmse": round(float(np.sqrt(mean_squared_error(y_test, y_pred_test))), 4),
            "train_r2": round(float(r2_score(y_train, y_pred_train)), 4),
            "train_samples": len(X_train),
            "test_samples": len(X_test),
        }

        # Store actual vs predicted for visualization (limit to 100 points for performance)
        test_comparison = []
        indices = list(range(len(y_test)))
        if len(indices) > 100:
            step = len(indices) // 100
            indices = indices[::step][:100]

        y_test_arr = y_test.values if hasattr(y_test, 'values') else np.array(y_test)
        for i, idx in enumerate(indices):
            actual_val = y_test_arr[idx] if idx < len(y_test_arr) else y_test_arr[i]
            pred_val = y_pred_test[idx] if idx < len(y_pred_test) else y_pred_test[i]
            test_comparison.append({
                "actual": round(float(actual_val), 4),
                "predicted": round(float(pred_val), 4),
            })

        # Calculate residuals distribution
        residuals = y_test_arr - y_pred_test
        residual_bins = np.histogram(residuals, bins=20)
        residual_distribution = [
            {"range": f"{residual_bins[1][i]:.2f}", "count": int(residual_bins[0][i])}
            for i in range(len(residual_bins[0]))
        ]

        # Feature importance (extract from model inside pipeline)
        trained_model = pipeline.named_steps['model']
        feature_importance = []

        # Get feature names after preprocessing
        # For numeric features, names stay the same
        # For categorical features, OneHotEncoder creates new names
        preprocessor = pipeline.named_steps['preprocessor']
        try:
            transformed_feature_names = preprocessor.get_feature_names_out()
        except Exception:
            # Fallback to original feature names if get_feature_names_out fails
            transformed_feature_names = column_types["numeric"] + column_types["categorical"]

        if hasattr(trained_model, 'feature_importances_'):
            importances = trained_model.feature_importances_
            for fname, imp in zip(transformed_feature_names, importances):
                # Clean up feature name (remove prefixes like 'num__' or 'cat__')
                clean_name = fname.split('__')[-1] if '__' in fname else fname
                feature_importance.append({
                    "feature": clean_name,
                    "importance": round(float(imp), 4)
                })
            feature_importance.sort(key=lambda x: x["importance"], reverse=True)
        elif hasattr(trained_model, 'coef_'):
            coefs = np.abs(trained_model.coef_)
            total = coefs.sum() if coefs.sum() > 0 else 1
            for fname, coef in zip(transformed_feature_names, coefs):
                clean_name = fname.split('__')[-1] if '__' in fname else fname
                feature_importance.append({
                    "feature": clean_name,
                    "importance": round(float(coef / total), 4)
                })
            feature_importance.sort(key=lambda x: x["importance"], reverse=True)

        return {
            "pipeline": pipeline,
            "column_types": column_types,
            "metrics": metrics,
            "feature_names": list(X.columns),
            "target_name": target,
            "test_comparison": test_comparison,
            "residual_distribution": residual_distribution,
            "feature_importance": feature_importance,
            "split_type": split_type,
        }

    def _train_with_walk_forward(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        date_series: pd.Series,
        model_type: str,
        column_types: Dict,
        feature_cols: List[str],
        target: str,
        n_cv_splits: int,
        test_size: float,
    ) -> Dict[str, Any]:
        """Train model using walk-forward cross-validation."""
        # Create temporary df for splitting
        temp_df = X.copy()
        temp_df['__date__'] = date_series
        temp_df['__target__'] = y

        # Get walk-forward folds
        folds = ValidationService.walk_forward_split(temp_df, '__date__', n_cv_splits, test_size)

        if not folds:
            raise ValueError("Not enough data for walk-forward cross-validation")

        # Store metrics for each fold
        cv_results = []
        all_test_predictions = []
        all_test_actuals = []

        model_class = self.MODEL_CLASSES.get(model_type)
        if not model_class:
            raise ValueError(f"Unknown model type: {model_type}")

        for fold_idx, (train_indices, test_indices) in enumerate(folds):
            X_train = X.iloc[train_indices]
            y_train = y.iloc[train_indices]
            X_test = X.iloc[test_indices]
            y_test = y.iloc[test_indices]

            # Create model instance
            if model_type == "xgboost":
                model_instance = model_class(n_estimators=100, max_depth=6, random_state=42)
            elif model_type == "random_forest":
                model_instance = model_class(n_estimators=100, max_depth=10, random_state=42)
            else:
                model_instance = model_class()

            # Build and fit pipeline
            pipeline = PreprocessingService.build_full_pipeline(
                numeric_features=column_types["numeric"],
                categorical_features=column_types["categorical"],
                model=model_instance
            )
            pipeline.fit(X_train, y_train)

            # Predict and evaluate
            y_pred = pipeline.predict(X_test)

            fold_metrics = {
                "fold": fold_idx + 1,
                "train_samples": len(X_train),
                "test_samples": len(X_test),
                "r2_score": round(float(r2_score(y_test, y_pred)), 4),
                "rmse": round(float(np.sqrt(mean_squared_error(y_test, y_pred))), 4),
                "mae": round(float(mean_absolute_error(y_test, y_pred)), 4),
            }
            cv_results.append(fold_metrics)

            # Collect predictions for visualization
            all_test_actuals.extend(y_test.tolist())
            all_test_predictions.extend(y_pred.tolist())

        # Train final model on all data
        if model_type == "xgboost":
            final_model = model_class(n_estimators=100, max_depth=6, random_state=42)
        elif model_type == "random_forest":
            final_model = model_class(n_estimators=100, max_depth=10, random_state=42)
        else:
            final_model = model_class()

        final_pipeline = PreprocessingService.build_full_pipeline(
            numeric_features=column_types["numeric"],
            categorical_features=column_types["categorical"],
            model=final_model
        )
        final_pipeline.fit(X, y)

        # Calculate mean and std of CV metrics
        mean_metrics = {
            "r2_score": round(float(np.mean([r["r2_score"] for r in cv_results])), 4),
            "rmse": round(float(np.mean([r["rmse"] for r in cv_results])), 4),
            "mae": round(float(np.mean([r["mae"] for r in cv_results])), 4),
            "train_samples": sum(r["train_samples"] for r in cv_results) // len(cv_results),
            "test_samples": sum(r["test_samples"] for r in cv_results),
        }
        std_metrics = {
            "r2_score": round(float(np.std([r["r2_score"] for r in cv_results])), 4),
            "rmse": round(float(np.std([r["rmse"] for r in cv_results])), 4),
            "mae": round(float(np.std([r["mae"] for r in cv_results])), 4),
        }

        # Create visualization data from all CV predictions
        test_comparison = []
        indices = list(range(len(all_test_actuals)))
        if len(indices) > 100:
            step = len(indices) // 100
            indices = indices[::step][:100]

        for idx in indices:
            test_comparison.append({
                "actual": round(float(all_test_actuals[idx]), 4),
                "predicted": round(float(all_test_predictions[idx]), 4),
            })

        # Residuals from all CV predictions
        residuals = np.array(all_test_actuals) - np.array(all_test_predictions)
        residual_bins = np.histogram(residuals, bins=20)
        residual_distribution = [
            {"range": f"{residual_bins[1][i]:.2f}", "count": int(residual_bins[0][i])}
            for i in range(len(residual_bins[0]))
        ]

        # Feature importance from final model
        trained_model = final_pipeline.named_steps['model']
        feature_importance = []
        preprocessor = final_pipeline.named_steps['preprocessor']
        try:
            transformed_feature_names = preprocessor.get_feature_names_out()
        except Exception:
            transformed_feature_names = column_types["numeric"] + column_types["categorical"]

        if hasattr(trained_model, 'feature_importances_'):
            importances = trained_model.feature_importances_
            for fname, imp in zip(transformed_feature_names, importances):
                clean_name = fname.split('__')[-1] if '__' in fname else fname
                feature_importance.append({
                    "feature": clean_name,
                    "importance": round(float(imp), 4)
                })
            feature_importance.sort(key=lambda x: x["importance"], reverse=True)
        elif hasattr(trained_model, 'coef_'):
            coefs = np.abs(trained_model.coef_)
            total = coefs.sum() if coefs.sum() > 0 else 1
            for fname, coef in zip(transformed_feature_names, coefs):
                clean_name = fname.split('__')[-1] if '__' in fname else fname
                feature_importance.append({
                    "feature": clean_name,
                    "importance": round(float(coef / total), 4)
                })
            feature_importance.sort(key=lambda x: x["importance"], reverse=True)

        return {
            "pipeline": final_pipeline,
            "column_types": column_types,
            "metrics": mean_metrics,
            "feature_names": list(X.columns),
            "target_name": target,
            "test_comparison": test_comparison,
            "residual_distribution": residual_distribution,
            "feature_importance": feature_importance,
            "split_type": "walk_forward",
            "cv_results": cv_results,
            "std_metrics": std_metrics,
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

        feature_names = model_data["feature_names"]
        df = pd.DataFrame(input_data)

        # Ensure we have all required features
        missing_features = set(feature_names) - set(df.columns)
        if missing_features:
            raise ValueError(f"Missing features in input data: {missing_features}")

        X = df[feature_names].copy()

        # Check if this is a new pipeline-based model or legacy model
        if "pipeline" in model_data:
            # New pipeline-based model - pipeline handles all preprocessing
            pipeline = model_data["pipeline"]
            predictions = pipeline.predict(X)
        else:
            # Legacy model - use old preprocessing logic for backward compatibility
            model = model_data["model"]
            for col in X.columns:
                if not pd.api.types.is_numeric_dtype(X[col]):
                    X[col] = pd.to_numeric(X[col], errors="coerce")
            X = X.fillna(0)
            predictions = model.predict(X)

        # Convert predictions to safe floats (handle NaN/Inf)
        result = []
        for p in predictions:
            val = float(p)
            if np.isnan(val) or np.isinf(val):
                val = 0.0
            result.append(round(val, 4))
        return result

    def predict_with_confidence(
        self, model_id: str, input_data: List[Dict], confidence_level: float = 0.95
    ) -> List[Dict[str, Any]]:
        """Make predictions with confidence intervals.

        For tree ensemble models (Random Forest, XGBoost), uses individual tree predictions
        to estimate uncertainty. For other models, uses training residual std as heuristic.
        """
        model_data = self.load_model(model_id)
        if not model_data:
            raise ValueError(f"Model not found: {model_id}")

        feature_names = model_data["feature_names"]
        df = pd.DataFrame(input_data)

        missing_features = set(feature_names) - set(df.columns)
        if missing_features:
            raise ValueError(f"Missing features in input data: {missing_features}")

        X = df[feature_names].copy()

        # Get the pipeline and model
        if "pipeline" not in model_data:
            # Legacy model - return basic predictions without confidence
            predictions = self.predict(model_id, input_data)
            return [{"prediction": p, "confidence_low": None, "confidence_high": None, "std": None} for p in predictions]

        pipeline = model_data["pipeline"]
        trained_model = pipeline.named_steps['model']

        # Preprocess the data
        preprocessor = pipeline.named_steps['preprocessor']
        X_transformed = preprocessor.transform(X)

        # Calculate z-score for confidence level
        from scipy import stats
        z_score = stats.norm.ppf(1 - (1 - confidence_level) / 2)

        results = []

        # For Random Forest - use individual tree predictions
        if isinstance(trained_model, RandomForestRegressor):
            # Get predictions from all trees
            tree_predictions = np.array([tree.predict(X_transformed) for tree in trained_model.estimators_])
            mean_predictions = np.mean(tree_predictions, axis=0)
            std_predictions = np.std(tree_predictions, axis=0)

            for i in range(len(X)):
                pred = round(float(mean_predictions[i]), 4)
                std = round(float(std_predictions[i]), 4)
                margin = z_score * std
                results.append({
                    "prediction": pred,
                    "confidence_low": round(pred - margin, 4),
                    "confidence_high": round(pred + margin, 4),
                    "std": std,
                    "confidence_level": confidence_level,
                })

        # For XGBoost - use ntree_limit to get predictions at different stages
        elif isinstance(trained_model, XGBRegressor):
            # XGBoost doesn't easily expose individual tree predictions
            # Use training RMSE as a heuristic for uncertainty
            metrics = model_data.get("metrics", {})
            rmse = metrics.get("rmse", 1.0)

            predictions = trained_model.predict(X_transformed)

            for i in range(len(X)):
                pred = round(float(predictions[i]), 4)
                margin = z_score * rmse
                results.append({
                    "prediction": pred,
                    "confidence_low": round(pred - margin, 4),
                    "confidence_high": round(pred + margin, 4),
                    "std": round(rmse, 4),
                    "confidence_level": confidence_level,
                })

        # For Linear Regression and others - use residual std from training
        else:
            metrics = model_data.get("metrics", {})
            rmse = metrics.get("rmse", 1.0)

            predictions = trained_model.predict(X_transformed)

            for i in range(len(X)):
                pred = round(float(predictions[i]), 4)
                margin = z_score * rmse
                results.append({
                    "prediction": pred,
                    "confidence_low": round(pred - margin, 4),
                    "confidence_high": round(pred + margin, 4),
                    "std": round(rmse, 4),
                    "confidence_level": confidence_level,
                })

        return results
