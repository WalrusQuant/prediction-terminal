from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import io

router = APIRouter()


class Dataset(BaseModel):
    id: str
    name: str
    rows: int
    columns: int
    features: List[str]


# In-memory storage for uploaded datasets (will move to proper storage later)
datasets = {}


@router.get("/")
async def list_datasets():
    return {
        "datasets": [
            {"id": k, "name": v["name"], "rows": v["rows"], "columns": v["columns"]}
            for k, v in datasets.items()
        ]
    }


@router.post("/upload")
async def upload_dataset(file: UploadFile = File(...)):
    contents = await file.read()

    try:
        df = pd.read_csv(io.StringIO(contents.decode("utf-8")))

        dataset_id = f"dataset_{len(datasets) + 1}"
        datasets[dataset_id] = {
            "name": file.filename,
            "rows": len(df),
            "columns": len(df.columns),
            "features": df.columns.tolist(),
            "data": df.to_dict(orient="records"),
        }

        return {
            "message": "Dataset uploaded successfully",
            "dataset_id": dataset_id,
            "name": file.filename,
            "rows": len(df),
            "columns": len(df.columns),
            "features": df.columns.tolist(),
            "preview": df.head(5).to_dict(orient="records"),
        }
    except Exception as e:
        return {"error": f"Failed to parse CSV: {str(e)}"}


@router.get("/{dataset_id}")
async def get_dataset(dataset_id: str):
    if dataset_id in datasets:
        ds = datasets[dataset_id]
        return {
            "id": dataset_id,
            "name": ds["name"],
            "rows": ds["rows"],
            "columns": ds["columns"],
            "features": ds["features"],
            "preview": ds["data"][:10],
        }
    return {"error": "Dataset not found"}
