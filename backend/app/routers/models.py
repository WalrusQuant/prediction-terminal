from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import uuid
import json
import os

from app.services.ml_service import MLService
from app.routers.data import datasets

router = APIRouter()
ml_service = MLService()

# In-memory model registry (metadata only, actual models on disk)
models_registry: Dict[str, Dict] = {}

METADATA_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "models_metadata.json"
)


class ModelType(str, Enum):
    LINEAR_REGRESSION = "linear_regression"
    RANDOM_FOREST = "random_forest"
    XGBOOST = "xgboost"


class TrainModelRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: str
    model_type: ModelType
    dataset_id: str
    features: List[str]
    target: str
    description: Optional[str] = None


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
        )

        # Save model to disk
        ml_service.save_model(
            model_id,
            {
                "model": result["model"],
                "feature_names": result["feature_names"],
                "target_name": result["target_name"],
                "model_type": request.model_type.value,
            },
        )

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
        }
        models_registry[model_id] = model_info

        # Persist metadata
        _save_models_metadata()

        return {"message": "Model trained successfully", "model": model_info}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{model_id}")
async def delete_model(model_id: str):
    _load_persisted_models()
    if model_id not in models_registry:
        raise HTTPException(status_code=404, detail="Model not found")

    ml_service.delete_model(model_id)
    del models_registry[model_id]
    _save_models_metadata()

    return {"message": "Model deleted", "model_id": model_id}
