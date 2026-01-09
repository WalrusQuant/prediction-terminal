"""Service for hyperparameter tuning using GridSearchCV or RandomizedSearchCV."""
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd
from sklearn.model_selection import GridSearchCV, RandomizedSearchCV, cross_val_score
from sklearn.linear_model import LinearRegression, Ridge, Lasso
from sklearn.ensemble import RandomForestRegressor
from xgboost import XGBRegressor
from sklearn.metrics import make_scorer, mean_squared_error, r2_score

from app.services.preprocessing_service import PreprocessingService


class TuningService:
    """Service for automated hyperparameter tuning."""

    # Define parameter grids for each model type
    PARAM_GRIDS = {
        "linear_regression": {
            # Linear regression has no hyperparameters, but we can try Ridge/Lasso
            "model_variants": ["linear", "ridge", "lasso"],
            "ridge_alpha": [0.01, 0.1, 1.0, 10.0],
            "lasso_alpha": [0.01, 0.1, 1.0, 10.0],
        },
        "random_forest": {
            "n_estimators": [50, 100, 200],
            "max_depth": [5, 10, 15, None],
            "min_samples_split": [2, 5, 10],
            "min_samples_leaf": [1, 2, 4],
        },
        "xgboost": {
            "n_estimators": [50, 100, 200],
            "max_depth": [3, 5, 7],
            "learning_rate": [0.01, 0.1, 0.2],
            "subsample": [0.8, 1.0],
            "colsample_bytree": [0.8, 1.0],
        },
    }

    @staticmethod
    def tune_model(
        model_type: str,
        X: pd.DataFrame,
        y: pd.Series,
        column_types: Dict[str, List[str]],
        n_iter: int = 20,
        cv: int = 5,
        method: str = "random"  # "random" or "grid"
    ) -> Dict[str, Any]:
        """
        Tune hyperparameters for a given model type.

        Args:
            model_type: Type of model to tune
            X: Feature DataFrame
            y: Target Series
            column_types: Dict with 'numeric' and 'categorical' feature lists
            n_iter: Number of iterations for random search
            cv: Number of cross-validation folds
            method: "random" for RandomizedSearchCV, "grid" for GridSearchCV

        Returns:
            Dict with best parameters, best score, and all results
        """
        if model_type not in TuningService.PARAM_GRIDS:
            raise ValueError(f"Tuning not supported for model type: {model_type}")

        # Build preprocessing pipeline
        preprocessor = PreprocessingService.build_preprocessor(
            numeric_features=column_types["numeric"],
            categorical_features=column_types["categorical"]
        )

        # Preprocess data
        X_processed = preprocessor.fit_transform(X)

        # Get base model and param grid
        if model_type == "linear_regression":
            return TuningService._tune_linear(X_processed, y, cv)
        elif model_type == "random_forest":
            return TuningService._tune_tree_model(
                RandomForestRegressor(random_state=42),
                TuningService.PARAM_GRIDS["random_forest"],
                X_processed, y, cv, n_iter, method
            )
        elif model_type == "xgboost":
            return TuningService._tune_tree_model(
                XGBRegressor(random_state=42, verbosity=0),
                TuningService.PARAM_GRIDS["xgboost"],
                X_processed, y, cv, n_iter, method
            )
        else:
            raise ValueError(f"Unknown model type: {model_type}")

    @staticmethod
    def _tune_linear(X: np.ndarray, y: pd.Series, cv: int) -> Dict[str, Any]:
        """Tune linear models by comparing Linear, Ridge, and Lasso."""
        results = []

        # Try standard Linear Regression
        lr = LinearRegression()
        lr_scores = cross_val_score(lr, X, y, cv=cv, scoring='r2')
        results.append({
            "variant": "linear",
            "params": {},
            "mean_r2": float(np.mean(lr_scores)),
            "std_r2": float(np.std(lr_scores)),
        })

        # Try Ridge with different alphas
        for alpha in TuningService.PARAM_GRIDS["linear_regression"]["ridge_alpha"]:
            ridge = Ridge(alpha=alpha)
            scores = cross_val_score(ridge, X, y, cv=cv, scoring='r2')
            results.append({
                "variant": "ridge",
                "params": {"alpha": alpha},
                "mean_r2": float(np.mean(scores)),
                "std_r2": float(np.std(scores)),
            })

        # Try Lasso with different alphas
        for alpha in TuningService.PARAM_GRIDS["linear_regression"]["lasso_alpha"]:
            lasso = Lasso(alpha=alpha, max_iter=10000)
            scores = cross_val_score(lasso, X, y, cv=cv, scoring='r2')
            results.append({
                "variant": "lasso",
                "params": {"alpha": alpha},
                "mean_r2": float(np.mean(scores)),
                "std_r2": float(np.std(scores)),
            })

        # Find best result
        best_result = max(results, key=lambda x: x["mean_r2"])

        return {
            "model_type": "linear_regression",
            "best_variant": best_result["variant"],
            "best_params": best_result["params"],
            "best_score": best_result["mean_r2"],
            "best_std": best_result["std_r2"],
            "all_results": results,
            "method": "comparison",
            "cv_folds": cv,
        }

    @staticmethod
    def _tune_tree_model(
        model,
        param_grid: Dict[str, List],
        X: np.ndarray,
        y: pd.Series,
        cv: int,
        n_iter: int,
        method: str
    ) -> Dict[str, Any]:
        """Tune tree-based models using GridSearchCV or RandomizedSearchCV."""
        scoring = make_scorer(r2_score)

        if method == "grid":
            # Full grid search (can be slow)
            search = GridSearchCV(
                model, param_grid, scoring=scoring, cv=cv, n_jobs=-1,
                return_train_score=True
            )
        else:
            # Random search (faster)
            search = RandomizedSearchCV(
                model, param_grid, n_iter=n_iter, scoring=scoring, cv=cv,
                n_jobs=-1, random_state=42, return_train_score=True
            )

        search.fit(X, y)

        # Extract results
        cv_results = []
        for i in range(len(search.cv_results_['params'])):
            cv_results.append({
                "params": search.cv_results_['params'][i],
                "mean_test_score": float(search.cv_results_['mean_test_score'][i]),
                "std_test_score": float(search.cv_results_['std_test_score'][i]),
                "mean_train_score": float(search.cv_results_['mean_train_score'][i]),
                "rank": int(search.cv_results_['rank_test_score'][i]),
            })

        # Sort by score
        cv_results.sort(key=lambda x: x["mean_test_score"], reverse=True)

        return {
            "model_type": type(model).__name__.lower(),
            "best_params": search.best_params_,
            "best_score": float(search.best_score_),
            "best_std": float(search.cv_results_['std_test_score'][search.best_index_]),
            "all_results": cv_results[:20],  # Top 20 results
            "total_iterations": len(cv_results),
            "method": method,
            "cv_folds": cv,
        }

    @staticmethod
    def get_recommended_params(model_type: str) -> Dict[str, Any]:
        """Get recommended starting parameters for a model type."""
        recommendations = {
            "linear_regression": {
                "description": "Linear models have few parameters. Consider Ridge or Lasso for regularization.",
                "recommended": {},
            },
            "random_forest": {
                "description": "Random Forest benefits from tuning n_estimators and max_depth.",
                "recommended": {
                    "n_estimators": 100,
                    "max_depth": 10,
                    "min_samples_split": 5,
                    "min_samples_leaf": 2,
                },
            },
            "xgboost": {
                "description": "XGBoost benefits from tuning learning_rate, max_depth, and n_estimators.",
                "recommended": {
                    "n_estimators": 100,
                    "max_depth": 5,
                    "learning_rate": 0.1,
                    "subsample": 0.8,
                },
            },
        }
        return recommendations.get(model_type, {"description": "No recommendations available", "recommended": {}})
