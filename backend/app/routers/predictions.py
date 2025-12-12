from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter()


class Prediction(BaseModel):
    id: str
    player: str
    market: str
    prop_type: str
    predicted_value: float
    confidence: float
    current_line: float
    edge: float
    timestamp: datetime


# Sample data matching your terminal aesthetic
SAMPLE_PREDICTIONS = [
    {
        "id": "1",
        "player": "Ajay Mitchell",
        "market": "Player Props",
        "prop_type": "Pts+Rebs+Asts",
        "predicted_value": 28.5,
        "confidence": 0.72,
        "current_line": 26.5,
        "edge": 7.5,
        "timestamp": datetime.now(),
    },
    {
        "id": "2",
        "player": "Devin Booker",
        "market": "Player Props",
        "prop_type": "Points",
        "predicted_value": 27.2,
        "confidence": 0.68,
        "current_line": 25.5,
        "edge": 6.7,
        "timestamp": datetime.now(),
    },
    {
        "id": "3",
        "player": "Grayson Allen",
        "market": "Player Props",
        "prop_type": "Points",
        "predicted_value": 14.8,
        "confidence": 0.65,
        "current_line": 13.5,
        "edge": 9.6,
        "timestamp": datetime.now(),
    },
    {
        "id": "4",
        "player": "Mark Williams",
        "market": "Player Props",
        "prop_type": "Rebounds",
        "predicted_value": 9.2,
        "confidence": 0.71,
        "current_line": 8.5,
        "edge": 8.2,
        "timestamp": datetime.now(),
    },
    {
        "id": "5",
        "player": "Royce O'Neale",
        "market": "Player Props",
        "prop_type": "3 Point FG",
        "predicted_value": 2.1,
        "confidence": 0.58,
        "current_line": 1.5,
        "edge": 12.3,
        "timestamp": datetime.now(),
    },
]


@router.get("/")
async def get_predictions():
    return {"predictions": SAMPLE_PREDICTIONS}


@router.get("/{prediction_id}")
async def get_prediction(prediction_id: str):
    for pred in SAMPLE_PREDICTIONS:
        if pred["id"] == prediction_id:
            return pred
    return {"error": "Prediction not found"}
