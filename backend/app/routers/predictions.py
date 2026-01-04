from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict
from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid

from app.services.ml_service import MLService
from app.routers.models import models_registry, _load_persisted_models

router = APIRouter()
ml_service = MLService()

# Store predictions history
predictions_history: Dict[str, Dict] = {}


class SinglePredictionRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_id: str
    input_data: Dict[str, Any]
    label: Optional[str] = None


class BatchPredictionRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_id: str
    data: List[Dict[str, Any]]
    labels: Optional[List[str]] = None


@router.get("/")
async def get_predictions():
    return {"predictions": list(predictions_history.values())}


@router.post("/single")
async def create_single_prediction(request: SinglePredictionRequest):
    _load_persisted_models()

    if request.model_id not in models_registry:
        raise HTTPException(status_code=404, detail="Model not found")

    try:
        predictions = ml_service.predict(request.model_id, [request.input_data])
        predicted_value = predictions[0]

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
            "input_data": request.input_data,
            "timestamp": datetime.now().isoformat(),
        }
        predictions_history[pred_id] = prediction_record

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
        predictions = ml_service.predict(request.model_id, request.data)
        model_info = models_registry[request.model_id]

        results = []
        for i, pred in enumerate(predictions):
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
                "predicted_value": pred,
                "input_data": request.data[i],
                "timestamp": datetime.now().isoformat(),
            }
            predictions_history[pred_id] = prediction_record
            results.append(prediction_record)

        return {"predictions": results, "count": len(results)}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{prediction_id}")
async def delete_prediction(prediction_id: str):
    if prediction_id in predictions_history:
        del predictions_history[prediction_id]
        return {"message": "Prediction deleted", "prediction_id": prediction_id}
    raise HTTPException(status_code=404, detail="Prediction not found")


@router.delete("/")
async def clear_predictions():
    predictions_history.clear()
    return {"message": "All predictions cleared"}
