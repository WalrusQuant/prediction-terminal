from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import uuid
import json
import os

from app.services.ml_service import MLService
from app.services.ensemble_service import EnsembleService
from app.services.tuning_service import TuningService
from app.routers.data import datasets

router = APIRouter()
ml_service = MLService()
ensemble_service = EnsembleService()
tuning_service = TuningService()

# In-memory model registry (metadata only, actual models on disk)
models_registry: Dict[str, Dict] = {}

METADATA_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "models_metadata.json"
)


class ModelType(str, Enum):
    LINEAR_REGRESSION = "linear_regression"
    RANDOM_FOREST = "random_forest"
    XGBOOST = "xgboost"


class SplitType(str, Enum):
    RANDOM = "random"
    TIME_BASED = "time_based"
    WALK_FORWARD = "walk_forward"


class TrainModelRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: str
    model_type: ModelType
    dataset_id: str
    features: List[str]
    target: str
    description: Optional[str] = None
    split_type: SplitType = SplitType.RANDOM
    date_column: Optional[str] = None
    n_cv_splits: int = 5


class ModelInfo(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    id: str
    name: str
    model_type: str
    dataset_id: str
    features: List[str]
    target: str
    status: str
    metrics: Optional[Dict[str, float]] = None
    accuracy: Optional[float] = None
    created_at: str
    last_run: Optional[str] = None
    description: Optional[str] = None


def _save_models_metadata():
    with open(METADATA_FILE, "w") as f:
        json.dump(models_registry, f, indent=2)


def _load_persisted_models():
    global models_registry
    if os.path.exists(METADATA_FILE):
        try:
            with open(METADATA_FILE, "r") as f:
                models_registry.update(json.load(f))
        except Exception:
            pass


# Load models on module import
_load_persisted_models()


@router.get("/")
async def list_models():
    _load_persisted_models()
    return {"models": list(models_registry.values())}


@router.get("/{model_id}")
async def get_model(model_id: str):
    _load_persisted_models()
    if model_id not in models_registry:
        raise HTTPException(status_code=404, detail="Model not found")
    return models_registry[model_id]


@router.get("/{model_id}/detail")
async def get_model_detail(model_id: str):
    """Get detailed model info including visualization data for charts."""
    _load_persisted_models()
    if model_id not in models_registry:
        raise HTTPException(status_code=404, detail="Model not found")

    # Load model from disk to get visualization data
    model_data = ml_service.load_model(model_id)
    if not model_data:
        raise HTTPException(status_code=404, detail="Model data not found on disk")

    model_info = models_registry[model_id].copy()

    # Add visualization data
    model_info["test_comparison"] = model_data.get("test_comparison", [])
    model_info["residual_distribution"] = model_data.get("residual_distribution", [])
    model_info["feature_importance"] = model_data.get("feature_importance", [])

    return model_info


@router.post("/")
async def train_model(request: TrainModelRequest):
    # Validate dataset exists
    if request.dataset_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    dataset = datasets[request.dataset_id]

    # Validate features and target exist
    available_cols = dataset["features"]
    for feat in request.features:
        if feat not in available_cols:
            raise HTTPException(
                status_code=400, detail=f"Feature '{feat}' not in dataset"
            )
    if request.target not in available_cols:
        raise HTTPException(
            status_code=400, detail=f"Target '{request.target}' not in dataset"
        )

    # Generate model ID
    model_id = f"model_{uuid.uuid4().hex[:8]}"

    try:
        # Train the model
        result = ml_service.train_model(
            model_type=request.model_type.value,
            features=request.features,
            target=request.target,
            data=dataset["data"],
            split_type=request.split_type.value,
            date_column=request.date_column,
            n_cv_splits=request.n_cv_splits,
        )

        # Save model to disk (including visualization data and pipeline)
        save_data = {
            "pipeline": result["pipeline"],
            "feature_names": result["feature_names"],
            "target_name": result["target_name"],
            "model_type": request.model_type.value,
            "test_comparison": result.get("test_comparison", []),
            "residual_distribution": result.get("residual_distribution", []),
            "feature_importance": result.get("feature_importance", []),
            "column_types": result.get("column_types", {}),
        }

        # Add CV results if walk-forward
        if result.get("cv_results"):
            save_data["cv_results"] = result["cv_results"]
            save_data["std_metrics"] = result.get("std_metrics", {})

        ml_service.save_model(model_id, save_data)

        # Register model metadata
        model_info = {
            "id": model_id,
            "name": request.name,
            "model_type": request.model_type.value,
            "dataset_id": request.dataset_id,
            "features": result["feature_names"],
            "target": request.target,
            "status": "trained",
            "metrics": result["metrics"],
            "accuracy": result["metrics"]["r2_score"],
            "created_at": datetime.now().isoformat(),
            "last_run": datetime.now().isoformat(),
            "description": request.description,
            "split_type": result.get("split_type", "random"),
            "date_column": request.date_column,
        }

        # Add CV metadata if walk-forward
        if result.get("cv_results"):
            model_info["cv_results"] = result["cv_results"]
            model_info["std_metrics"] = result.get("std_metrics", {})

        models_registry[model_id] = model_info

        # Persist metadata
        _save_models_metadata()

        return {"message": "Model trained successfully", "model": model_info}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{model_id}/favorite")
async def toggle_model_favorite(model_id: str):
    """Toggle the favorite status of a model."""
    _load_persisted_models()
    if model_id not in models_registry:
        raise HTTPException(status_code=404, detail="Model not found")

    current = models_registry[model_id].get("is_favorite", False)
    models_registry[model_id]["is_favorite"] = not current
    _save_models_metadata()

    return {
        "model_id": model_id,
        "is_favorite": models_registry[model_id]["is_favorite"]
    }


class RenameModelRequest(BaseModel):
    name: str


@router.patch("/{model_id}/rename")
async def rename_model(model_id: str, request: RenameModelRequest):
    """Rename a model and update all associated predictions."""
    from app.routers.predictions import update_model_name_in_predictions

    _load_persisted_models()
    if model_id not in models_registry:
        raise HTTPException(status_code=404, detail="Model not found")

    new_name = request.name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")

    models_registry[model_id]["name"] = new_name
    _save_models_metadata()

    # Update model name in all existing predictions
    update_model_name_in_predictions(model_id, new_name)

    return {
        "model_id": model_id,
        "name": new_name
    }


@router.delete("/{model_id}")
async def delete_model(model_id: str):
    _load_persisted_models()
    if model_id not in models_registry:
        raise HTTPException(status_code=404, detail="Model not found")

    ml_service.delete_model(model_id)
    del models_registry[model_id]
    _save_models_metadata()

    return {"message": "Model deleted", "model_id": model_id}


class EnsemblePredictRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_ids: List[str]
    input_data: List[Dict[str, Any]]
    weights: Optional[Dict[str, float]] = None
    method: str = "weighted"  # weighted or median


@router.post("/ensemble/predict")
async def create_ensemble_prediction(request: EnsemblePredictRequest):
    """Create predictions using an ensemble of models."""
    _load_persisted_models()

    # Validate all models exist and are trained
    for model_id in request.model_ids:
        if model_id not in models_registry:
            raise HTTPException(status_code=404, detail=f"Model not found: {model_id}")
        if models_registry[model_id].get("status") != "trained":
            raise HTTPException(status_code=400, detail=f"Model not trained: {model_id}")

    if len(request.model_ids) < 2:
        raise HTTPException(status_code=400, detail="Ensemble requires at least 2 models")

    if not request.input_data:
        raise HTTPException(status_code=400, detail="No input data provided")

    try:
        # Get predictions from each model
        predictions: Dict[str, List[float]] = {}
        for model_id in request.model_ids:
            preds = ml_service.predict(model_id, request.input_data)
            predictions[model_id] = preds

        # Create ensemble predictions
        if request.method == "median":
            ensemble_preds = ensemble_service.create_median_ensemble(predictions)
        else:
            ensemble_preds = ensemble_service.create_weighted_ensemble(
                predictions, request.weights
            )

        # Get ensemble stats
        stats = ensemble_service.get_ensemble_stats(predictions, ensemble_preds)

        # Build response with individual and ensemble predictions
        results = []
        for i, ensemble_pred in enumerate(ensemble_preds):
            individual = {mid: predictions[mid][i] for mid in request.model_ids}
            results.append({
                "index": i,
                "ensemble_prediction": ensemble_pred,
                "individual_predictions": individual,
            })

        return {
            "ensemble_predictions": ensemble_preds,
            "detailed_results": results,
            "stats": stats,
            "method": request.method,
            "model_names": {
                mid: models_registry[mid]["name"]
                for mid in request.model_ids
            }
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ensemble/compatible")
async def get_compatible_models():
    """Get groups of models that can be ensembled together (same target and features)."""
    _load_persisted_models()

    # Group models by target and features
    groups: Dict[str, List[Dict]] = {}
    for model_id, model_info in models_registry.items():
        if model_info.get("status") != "trained":
            continue

        # Create a key based on target and sorted features
        features_key = ",".join(sorted(model_info.get("features", [])))
        group_key = f"{model_info.get('target', '')}|{features_key}"

        if group_key not in groups:
            groups[group_key] = []

        groups[group_key].append({
            "id": model_id,
            "name": model_info["name"],
            "model_type": model_info["model_type"],
            "target": model_info.get("target"),
            "features": model_info.get("features", []),
            "metrics": model_info.get("metrics", {}),
        })

    # Only return groups with 2+ models
    compatible_groups = []
    for group_key, models in groups.items():
        if len(models) >= 2:
            compatible_groups.append({
                "target": models[0]["target"],
                "features": models[0]["features"],
                "models": models,
            })

    return {"compatible_groups": compatible_groups}


class TuneModelRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_type: ModelType
    dataset_id: str
    features: List[str]
    target: str
    n_iter: int = 20
    cv_folds: int = 5
    method: str = "random"  # "random" or "grid"


@router.post("/tune")
async def tune_model(request: TuneModelRequest):
    """Run hyperparameter tuning for a model type."""
    import pandas as pd
    from app.services.preprocessing_service import PreprocessingService

    # Validate dataset exists
    if request.dataset_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    dataset = datasets[request.dataset_id]

    # Validate features and target
    available_cols = dataset["features"]
    for feat in request.features:
        if feat not in available_cols:
            raise HTTPException(status_code=400, detail=f"Feature '{feat}' not in dataset")
    if request.target not in available_cols:
        raise HTTPException(status_code=400, detail=f"Target '{request.target}' not in dataset")

    try:
        # Prepare data
        df = pd.DataFrame(dataset["data"])
        X = df[request.features].copy()
        y = df[request.target].copy()

        # Handle non-numeric target
        if not pd.api.types.is_numeric_dtype(y):
            y = pd.to_numeric(y, errors="coerce")

        # Drop rows with NaN target
        valid_mask = ~y.isna()
        X = X[valid_mask].reset_index(drop=True)
        y = y[valid_mask].reset_index(drop=True)

        if len(X) < 20:
            raise ValueError("Not enough valid data for tuning (need at least 20 rows)")

        # Detect column types
        column_types = PreprocessingService.detect_column_types(X, request.features)

        # Run tuning
        result = tuning_service.tune_model(
            model_type=request.model_type.value,
            X=X,
            y=y,
            column_types=column_types,
            n_iter=request.n_iter,
            cv=request.cv_folds,
            method=request.method
        )

        return {"message": "Tuning complete", "result": result}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tune/recommendations/{model_type}")
async def get_tuning_recommendations(model_type: str):
    """Get recommended parameters for a model type."""
    return tuning_service.get_recommended_params(model_type)


class FeatureAnalysisRequest(BaseModel):
    dataset_id: str
    target: str


@router.post("/analyze-features")
async def analyze_features(request: FeatureAnalysisRequest):
    """Analyze feature correlations with target to help with feature selection.

    Returns correlation of each feature with target, flags potential data leakage,
    and suggests which features to use or avoid.
    """
    import pandas as pd
    import numpy as np

    if request.dataset_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    dataset = datasets[request.dataset_id]
    df = pd.DataFrame(dataset["data"])

    if request.target not in df.columns:
        raise HTTPException(status_code=400, detail=f"Target '{request.target}' not in dataset")

    # Convert columns to numeric where possible
    for col in df.columns:
        if df[col].dtype == 'object':
            converted = pd.to_numeric(df[col], errors='coerce')
            if converted.notna().sum() >= len(df) * 0.5:
                df[col] = converted

    # Get target column
    target_series = df[request.target]
    if not pd.api.types.is_numeric_dtype(target_series):
        target_series = pd.to_numeric(target_series, errors='coerce')

    # Analyze each potential feature
    feature_analysis = []
    numeric_features = []

    for col in df.columns:
        if col == request.target:
            continue

        col_data = df[col]
        is_numeric = pd.api.types.is_numeric_dtype(col_data)

        analysis = {
            "feature": col,
            "dtype": str(df[col].dtype),
            "is_numeric": is_numeric,
            "missing_count": int(col_data.isna().sum()),
            "missing_percent": round(col_data.isna().sum() / len(df) * 100, 1),
            "unique_count": int(col_data.nunique()),
            "correlation": None,
            "abs_correlation": None,
            "recommendation": "neutral",
            "warning": None,
        }

        if is_numeric:
            numeric_features.append(col)
            # Calculate correlation with target
            try:
                valid_mask = col_data.notna() & target_series.notna()
                if valid_mask.sum() > 10:
                    corr = col_data[valid_mask].corr(target_series[valid_mask])
                    if not pd.isna(corr):
                        analysis["correlation"] = round(float(corr), 4)
                        analysis["abs_correlation"] = round(abs(float(corr)), 4)

                        # Classify the feature
                        abs_corr = abs(corr)
                        if abs_corr >= 0.95:
                            analysis["recommendation"] = "avoid"
                            analysis["warning"] = "Extremely high correlation - likely data leakage"
                        elif abs_corr >= 0.85:
                            analysis["recommendation"] = "caution"
                            analysis["warning"] = "Very high correlation - possible data leakage"
                        elif abs_corr >= 0.5:
                            analysis["recommendation"] = "good"
                        elif abs_corr >= 0.2:
                            analysis["recommendation"] = "moderate"
                        elif abs_corr >= 0.05:
                            analysis["recommendation"] = "weak"
                        else:
                            analysis["recommendation"] = "very_weak"
                            analysis["warning"] = "Very low correlation - may not be useful"
            except Exception:
                pass
        else:
            # Non-numeric feature
            if analysis["unique_count"] <= 1:
                analysis["recommendation"] = "avoid"
                analysis["warning"] = "Constant value - no predictive power"
            elif analysis["unique_count"] > len(df) * 0.9:
                analysis["recommendation"] = "avoid"
                analysis["warning"] = "Too many unique values - likely an ID column"
            else:
                analysis["recommendation"] = "categorical"
                analysis["warning"] = "Categorical feature - will be encoded"

        feature_analysis.append(analysis)

    # Sort by absolute correlation (highest first), with non-numeric at end
    feature_analysis.sort(
        key=lambda x: (x["abs_correlation"] is None, -(x["abs_correlation"] or 0))
    )

    # Generate summary
    good_features = [f["feature"] for f in feature_analysis if f["recommendation"] == "good"]
    moderate_features = [f["feature"] for f in feature_analysis if f["recommendation"] == "moderate"]
    caution_features = [f["feature"] for f in feature_analysis if f["recommendation"] == "caution"]
    avoid_features = [f["feature"] for f in feature_analysis if f["recommendation"] == "avoid"]

    return {
        "target": request.target,
        "total_features": len(feature_analysis),
        "numeric_features": len(numeric_features),
        "features": feature_analysis,
        "summary": {
            "good": good_features,
            "moderate": moderate_features,
            "caution": caution_features,
            "avoid": avoid_features,
        },
        "suggestion": f"Consider using {len(good_features)} good features and {len(moderate_features)} moderate features. "
                      f"{'Avoid ' + str(len(avoid_features)) + ' features with potential data leakage.' if avoid_features else ''}"
    }
