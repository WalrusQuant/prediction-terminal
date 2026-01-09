from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict
from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid
import json
import os

from app.services.ml_service import MLService
from app.routers.models import models_registry, _load_persisted_models

router = APIRouter()
ml_service = MLService()

# Store predictions history with persistence
PREDICTIONS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "predictions")
os.makedirs(PREDICTIONS_DIR, exist_ok=True)
PREDICTIONS_FILE = os.path.join(PREDICTIONS_DIR, "predictions.json")

predictions_history: Dict[str, Dict] = {}


def _save_predictions():
    """Persist predictions to disk."""
    with open(PREDICTIONS_FILE, "w") as f:
        json.dump(predictions_history, f, indent=2)


def _load_predictions():
    """Load predictions from disk."""
    global predictions_history
    if os.path.exists(PREDICTIONS_FILE):
        try:
            with open(PREDICTIONS_FILE, "r") as f:
                predictions_history.update(json.load(f))
        except Exception:
            pass


# Load on module import
_load_predictions()


def update_model_name_in_predictions(model_id: str, new_name: str):
    """Update model_name for all predictions with the given model_id."""
    _load_predictions()
    updated = False
    for pred_id, pred in predictions_history.items():
        if pred.get("model_id") == model_id:
            pred["model_name"] = new_name
            updated = True
    if updated:
        _save_predictions()
    return updated


class SinglePredictionRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_id: str
    input_data: Dict[str, Any]
    label: Optional[str] = None
    with_confidence: Optional[bool] = False
    confidence_level: Optional[float] = 0.95


class BatchPredictionRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_id: str
    data: List[Dict[str, Any]]
    labels: Optional[List[str]] = None
    with_confidence: Optional[bool] = False
    confidence_level: Optional[float] = 0.95


class UpdateActualRequest(BaseModel):
    actual_value: float


@router.get("/")
async def get_predictions():
    _load_predictions()
    return {"predictions": list(predictions_history.values())}


@router.post("/single")
async def create_single_prediction(request: SinglePredictionRequest):
    _load_persisted_models()

    if request.model_id not in models_registry:
        raise HTTPException(status_code=404, detail="Model not found")

    try:
        # Get prediction with or without confidence
        if request.with_confidence:
            results = ml_service.predict_with_confidence(
                request.model_id,
                [request.input_data],
                confidence_level=request.confidence_level or 0.95
            )
            predicted_value = results[0]["prediction"]
            confidence_low = results[0].get("confidence_low")
            confidence_high = results[0].get("confidence_high")
            confidence_std = results[0].get("std")
        else:
            predictions = ml_service.predict(request.model_id, [request.input_data])
            predicted_value = predictions[0]
            confidence_low = None
            confidence_high = None
            confidence_std = None

        model_info = models_registry[request.model_id]

        pred_id = f"pred_{uuid.uuid4().hex[:8]}"
        label = request.label or "Single prediction"

        prediction_record = {
            "id": pred_id,
            "model_id": request.model_id,
            "model_name": model_info["name"],
            "label": label,
            "target": model_info["target"],
            "predicted_value": predicted_value,
            "confidence_low": confidence_low,
            "confidence_high": confidence_high,
            "confidence_std": confidence_std,
            "actual_value": None,
            "error": None,
            "input_data": request.input_data,
            "timestamp": datetime.now().isoformat(),
        }
        predictions_history[pred_id] = prediction_record
        _save_predictions()

        return {"prediction": prediction_record}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch")
async def create_batch_predictions(request: BatchPredictionRequest):
    _load_persisted_models()

    if request.model_id not in models_registry:
        raise HTTPException(status_code=404, detail="Model not found")

    if not request.data:
        raise HTTPException(status_code=400, detail="No data provided")

    try:
        # Get predictions with or without confidence
        if request.with_confidence:
            confidence_results = ml_service.predict_with_confidence(
                request.model_id,
                request.data,
                confidence_level=request.confidence_level or 0.95
            )
        else:
            basic_predictions = ml_service.predict(request.model_id, request.data)
            confidence_results = [
                {"prediction": p, "confidence_low": None, "confidence_high": None, "std": None}
                for p in basic_predictions
            ]

        model_info = models_registry[request.model_id]

        results = []
        for i, conf_result in enumerate(confidence_results):
            pred_id = f"pred_{uuid.uuid4().hex[:8]}"
            label = (
                request.labels[i]
                if request.labels and i < len(request.labels)
                else f"Row {i + 1}"
            )

            prediction_record = {
                "id": pred_id,
                "model_id": request.model_id,
                "model_name": model_info["name"],
                "label": label,
                "target": model_info["target"],
                "predicted_value": conf_result["prediction"],
                "confidence_low": conf_result.get("confidence_low"),
                "confidence_high": conf_result.get("confidence_high"),
                "confidence_std": conf_result.get("std"),
                "actual_value": None,
                "error": None,
                "input_data": request.data[i],
                "timestamp": datetime.now().isoformat(),
            }
            predictions_history[pred_id] = prediction_record
            results.append(prediction_record)

        _save_predictions()
        return {"predictions": results, "count": len(results)}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{prediction_id}/actual")
async def update_actual_value(prediction_id: str, request: UpdateActualRequest):
    """Update the actual value for a prediction and calculate error."""
    _load_predictions()
    if prediction_id not in predictions_history:
        raise HTTPException(status_code=404, detail="Prediction not found")

    pred = predictions_history[prediction_id]
    pred["actual_value"] = request.actual_value
    pred["error"] = request.actual_value - pred["predicted_value"]
    pred["absolute_error"] = abs(pred["error"])
    pred["percent_error"] = (
        abs(pred["error"] / request.actual_value) * 100
        if request.actual_value != 0
        else None
    )

    _save_predictions()
    return {"message": "Actual value updated", "prediction": pred}


@router.get("/accuracy")
async def get_accuracy_stats():
    """Get accuracy statistics for predictions with actual values."""
    _load_predictions()

    predictions_with_actuals = [
        p for p in predictions_history.values()
        if p.get("actual_value") is not None
    ]

    if not predictions_with_actuals:
        return {
            "total_predictions": len(predictions_history),
            "predictions_with_actuals": 0,
            "mae": None,
            "mse": None,
            "rmse": None,
            "avg_percent_error": None,
            "by_model": {}
        }

    # Calculate overall metrics
    errors = [p["error"] for p in predictions_with_actuals]
    abs_errors = [abs(e) for e in errors]
    percent_errors = [p["percent_error"] for p in predictions_with_actuals if p.get("percent_error") is not None]

    mae = sum(abs_errors) / len(abs_errors)
    mse = sum(e ** 2 for e in errors) / len(errors)
    rmse = mse ** 0.5
    avg_percent_error = sum(percent_errors) / len(percent_errors) if percent_errors else None

    # Calculate per-model stats
    by_model: Dict[str, Any] = {}
    for pred in predictions_with_actuals:
        model_name = pred["model_name"]
        if model_name not in by_model:
            by_model[model_name] = {"predictions": [], "model_id": pred["model_id"]}
        by_model[model_name]["predictions"].append(pred)

    model_stats = {}
    for model_name, data in by_model.items():
        preds = data["predictions"]
        model_errors = [p["error"] for p in preds]
        model_abs_errors = [abs(e) for e in model_errors]
        model_stats[model_name] = {
            "model_id": data["model_id"],
            "count": len(preds),
            "mae": sum(model_abs_errors) / len(model_abs_errors),
            "rmse": (sum(e ** 2 for e in model_errors) / len(model_errors)) ** 0.5,
        }

    return {
        "total_predictions": len(predictions_history),
        "predictions_with_actuals": len(predictions_with_actuals),
        "mae": mae,
        "mse": mse,
        "rmse": rmse,
        "avg_percent_error": avg_percent_error,
        "by_model": model_stats
    }


@router.delete("/{prediction_id}")
async def delete_prediction(prediction_id: str):
    _load_predictions()
    if prediction_id in predictions_history:
        del predictions_history[prediction_id]
        _save_predictions()
        return {"message": "Prediction deleted", "prediction_id": prediction_id}
    raise HTTPException(status_code=404, detail="Prediction not found")


@router.delete("/")
async def clear_predictions():
    predictions_history.clear()
    _save_predictions()
    return {"message": "All predictions cleared"}
