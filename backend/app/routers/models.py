from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum

router = APIRouter()


class ModelType(str, Enum):
    LINEAR_REGRESSION = "linear_regression"
    RANDOM_FOREST = "random_forest"
    XGBOOST = "xgboost"
    NEURAL_NETWORK = "neural_network"


class ModelConfig(BaseModel):
    name: str
    model_type: ModelType
    features: List[str]
    target: str
    description: Optional[str] = None


class ModelInfo(BaseModel):
    id: str
    name: str
    model_type: ModelType
    status: str
    accuracy: Optional[float] = None
    created_at: datetime
    last_run: Optional[datetime] = None


# Sample models
SAMPLE_MODELS = [
    {
        "id": "model_1",
        "name": "NBA Points Predictor",
        "model_type": ModelType.XGBOOST,
        "status": "trained",
        "accuracy": 0.73,
        "created_at": datetime.now(),
        "last_run": datetime.now(),
    },
    {
        "id": "model_2",
        "name": "PRA Ensemble",
        "model_type": ModelType.RANDOM_FOREST,
        "status": "trained",
        "accuracy": 0.68,
        "created_at": datetime.now(),
        "last_run": datetime.now(),
    },
    {
        "id": "model_3",
        "name": "Rebounds Baseline",
        "model_type": ModelType.LINEAR_REGRESSION,
        "status": "training",
        "accuracy": None,
        "created_at": datetime.now(),
        "last_run": None,
    },
]


@router.get("/")
async def list_models():
    return {"models": SAMPLE_MODELS}


@router.get("/{model_id}")
async def get_model(model_id: str):
    for model in SAMPLE_MODELS:
        if model["id"] == model_id:
            return model
    return {"error": "Model not found"}


@router.post("/")
async def create_model(config: ModelConfig):
    # Placeholder - will implement actual model creation
    return {
        "message": "Model creation started",
        "model_id": "model_new",
        "config": config,
    }
