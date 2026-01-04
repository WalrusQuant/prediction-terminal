from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import numpy as np
import io
import json

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

        # Replace inf/-inf with NaN, then convert to Python-native types
        # This ensures JSON serialization works properly
        df = df.replace([np.inf, -np.inf], np.nan)

        # Convert to records and clean NaN values manually
        def clean_record(record):
            return {k: (None if pd.isna(v) else v) for k, v in record.items()}

        data_records = [clean_record(r) for r in df.to_dict(orient="records")]
        preview_records = [clean_record(r) for r in df.head(5).to_dict(orient="records")]

        dataset_id = f"dataset_{len(datasets) + 1}"
        datasets[dataset_id] = {
            "name": file.filename,
            "rows": len(df),
            "columns": len(df.columns),
            "features": df.columns.tolist(),
            "data": data_records,
        }

        return {
            "message": "Dataset uploaded successfully",
            "dataset_id": dataset_id,
            "name": file.filename,
            "rows": len(df),
            "columns": len(df.columns),
            "features": df.columns.tolist(),
            "preview": preview_records,
        }
    except Exception as e:
        return {"error": f"Failed to parse CSV: {str(e)}"}


@router.get("/{dataset_id}")
async def get_dataset(dataset_id: str):
    if dataset_id in datasets:
        ds = datasets[dataset_id]
        df = pd.DataFrame(ds["data"])
        column_types = {col: str(df[col].dtype) for col in df.columns}
        return {
            "id": dataset_id,
            "name": ds["name"],
            "rows": ds["rows"],
            "columns": ds["columns"],
            "features": ds["features"],
            "column_types": column_types,
            "preview": ds["data"][:10],
        }
    return {"error": "Dataset not found"}


@router.get("/{dataset_id}/stats")
async def get_dataset_stats(dataset_id: str):
    if dataset_id not in datasets:
        return {"error": "Dataset not found"}

    ds = datasets[dataset_id]
    df = pd.DataFrame(ds["data"])

    columns_stats = {}
    for col in df.columns:
        col_stats = {
            "dtype": str(df[col].dtype),
            "null_count": int(df[col].isnull().sum()),
            "unique_count": int(df[col].nunique()),
        }
        if pd.api.types.is_numeric_dtype(df[col]):
            col_stats.update({
                "min": float(df[col].min()) if not pd.isna(df[col].min()) else None,
                "max": float(df[col].max()) if not pd.isna(df[col].max()) else None,
                "mean": float(df[col].mean()) if not pd.isna(df[col].mean()) else None,
                "std": float(df[col].std()) if not pd.isna(df[col].std()) else None,
            })
        columns_stats[col] = col_stats

    return {
        "dataset_id": dataset_id,
        "total_rows": ds["rows"],
        "total_columns": ds["columns"],
        "columns": columns_stats,
    }


@router.delete("/{dataset_id}")
async def delete_dataset(dataset_id: str):
    if dataset_id in datasets:
        del datasets[dataset_id]
        return {"message": "Dataset deleted", "dataset_id": dataset_id}
    return {"error": "Dataset not found"}
