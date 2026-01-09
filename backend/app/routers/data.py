from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime
import pandas as pd
import numpy as np
import io
import json
import os

from app.services.data_quality_service import DataQualityService
from app.services.validation_service import ValidationService
from app.services.feature_engineering_service import FeatureEngineeringService

router = APIRouter()

# Directory for persisting datasets
DATASETS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "datasets")
os.makedirs(DATASETS_DIR, exist_ok=True)

# Directory for dataset snapshots (undo history)
SNAPSHOTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "snapshots")
os.makedirs(SNAPSHOTS_DIR, exist_ok=True)

# In-memory snapshot metadata
dataset_snapshots: Dict[str, List[dict]] = {}


class Dataset(BaseModel):
    id: str
    name: str
    rows: int
    columns: int
    features: List[str]


class CleanOperation(BaseModel):
    type: str  # fill_missing, delete_column, delete_rows, remove_duplicates, remove_outliers
    column: Optional[str] = None
    strategy: Optional[str] = None  # median, mean, mode
    indices: Optional[List[int]] = None


class CleaningRequest(BaseModel):
    operations: List[CleanOperation]


class FeatureEngineerRequest(BaseModel):
    operation_type: str  # rolling_average, ratio, difference, percentage_change, lag, product
    column: Optional[str] = None
    column1: Optional[str] = None
    column2: Optional[str] = None
    numerator: Optional[str] = None
    denominator: Optional[str] = None
    window: Optional[int] = None
    periods: Optional[int] = None
    new_column_name: Optional[str] = None


class ImportUrlRequest(BaseModel):
    url: str
    name: Optional[str] = None


# In-memory storage for uploaded datasets
datasets = {}


def _save_dataset(dataset_id: str, dataset_data: dict):
    """Save dataset to disk as JSON."""
    filepath = os.path.join(DATASETS_DIR, f"{dataset_id}.json")
    with open(filepath, "w") as f:
        json.dump(dataset_data, f)


def _load_persisted_datasets():
    """Load all persisted datasets from disk."""
    global datasets
    print(f"[DATA] Loading datasets from: {DATASETS_DIR}")
    if os.path.exists(DATASETS_DIR):
        files = os.listdir(DATASETS_DIR)
        print(f"[DATA] Found {len(files)} files in datasets directory")
        for filename in files:
            if filename.endswith(".json"):
                filepath = os.path.join(DATASETS_DIR, filename)
                try:
                    with open(filepath, "r") as f:
                        data = json.load(f)
                        dataset_id = filename.replace(".json", "")
                        datasets[dataset_id] = data
                        print(f"[DATA] Loaded dataset: {dataset_id} ({data.get('name', 'unknown')})")
                except Exception as e:
                    print(f"[DATA] Failed to load dataset {filename}: {e}")
        print(f"[DATA] Total datasets loaded: {len(datasets)}")
    else:
        print(f"[DATA] Datasets directory does not exist: {DATASETS_DIR}")


def _delete_dataset_file(dataset_id: str):
    """Delete dataset file from disk."""
    filepath = os.path.join(DATASETS_DIR, f"{dataset_id}.json")
    if os.path.exists(filepath):
        os.remove(filepath)


def _save_snapshot(dataset_id: str, dataset_data: dict, description: str) -> str:
    """Save a snapshot of the dataset before a cleaning operation."""
    import time
    snapshot_id = f"snap_{int(time.time() * 1000)}"

    # Save snapshot data to disk
    snapshot_dir = os.path.join(SNAPSHOTS_DIR, dataset_id)
    os.makedirs(snapshot_dir, exist_ok=True)

    filepath = os.path.join(snapshot_dir, f"{snapshot_id}.json")
    with open(filepath, "w") as f:
        json.dump(dataset_data, f)

    # Update metadata
    if dataset_id not in dataset_snapshots:
        dataset_snapshots[dataset_id] = []

    snapshot_meta = {
        "id": snapshot_id,
        "timestamp": datetime.now().isoformat(),
        "description": description,
        "rows": dataset_data["rows"],
        "columns": dataset_data["columns"]
    }
    dataset_snapshots[dataset_id].append(snapshot_meta)

    # Keep only last 10 snapshots per dataset
    if len(dataset_snapshots[dataset_id]) > 10:
        old_snapshot = dataset_snapshots[dataset_id].pop(0)
        old_filepath = os.path.join(snapshot_dir, f"{old_snapshot['id']}.json")
        if os.path.exists(old_filepath):
            os.remove(old_filepath)

    return snapshot_id


def _load_snapshot(dataset_id: str, snapshot_id: str) -> Optional[dict]:
    """Load a snapshot from disk."""
    filepath = os.path.join(SNAPSHOTS_DIR, dataset_id, f"{snapshot_id}.json")
    if os.path.exists(filepath):
        with open(filepath, "r") as f:
            return json.load(f)
    return None


def _load_snapshot_metadata():
    """Load snapshot metadata from disk."""
    global dataset_snapshots
    if os.path.exists(SNAPSHOTS_DIR):
        for dataset_id in os.listdir(SNAPSHOTS_DIR):
            dataset_snap_dir = os.path.join(SNAPSHOTS_DIR, dataset_id)
            if os.path.isdir(dataset_snap_dir):
                snapshots = []
                for filename in sorted(os.listdir(dataset_snap_dir)):
                    if filename.endswith(".json"):
                        snapshot_id = filename.replace(".json", "")
                        filepath = os.path.join(dataset_snap_dir, filename)
                        try:
                            with open(filepath, "r") as f:
                                data = json.load(f)
                                # Get file modification time as approximate timestamp
                                mtime = os.path.getmtime(filepath)
                                snapshots.append({
                                    "id": snapshot_id,
                                    "timestamp": datetime.fromtimestamp(mtime).isoformat(),
                                    "description": "Restored snapshot",
                                    "rows": data.get("rows", 0),
                                    "columns": data.get("columns", 0)
                                })
                        except Exception:
                            pass
                if snapshots:
                    dataset_snapshots[dataset_id] = snapshots


def _delete_dataset_snapshots(dataset_id: str):
    """Delete all snapshots for a dataset."""
    snapshot_dir = os.path.join(SNAPSHOTS_DIR, dataset_id)
    if os.path.exists(snapshot_dir):
        import shutil
        shutil.rmtree(snapshot_dir)
    if dataset_id in dataset_snapshots:
        del dataset_snapshots[dataset_id]


# Load persisted datasets on module import
_load_persisted_datasets()
_load_snapshot_metadata()


@router.get("/")
async def list_datasets():
    print(f"[DATA] list_datasets called, {len(datasets)} datasets in memory")
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

        # Generate unique ID using timestamp
        import time
        dataset_id = f"dataset_{int(time.time() * 1000)}"

        dataset_data = {
            "name": file.filename,
            "rows": len(df),
            "columns": len(df.columns),
            "features": df.columns.tolist(),
            "data": data_records,
        }
        datasets[dataset_id] = dataset_data

        # Persist to disk
        _save_dataset(dataset_id, dataset_data)

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


@router.post("/import-url")
async def import_from_url(request: ImportUrlRequest):
    """Import a dataset from a URL (CSV format)."""
    import time
    import requests

    try:
        # Fetch the CSV from URL
        response = requests.get(request.url, timeout=30)
        response.raise_for_status()

        # Parse CSV
        df = pd.read_csv(io.StringIO(response.text))

        # Replace inf/-inf with NaN
        df = df.replace([np.inf, -np.inf], np.nan)

        # Convert to records and clean NaN values
        def clean_record(record):
            return {k: (None if pd.isna(v) else v) for k, v in record.items()}

        data_records = [clean_record(r) for r in df.to_dict(orient="records")]

        # Generate unique ID
        dataset_id = f"dataset_{int(time.time() * 1000)}"

        # Determine name from URL or use provided name
        if request.name:
            name = request.name
        else:
            # Extract filename from URL
            from urllib.parse import urlparse
            path = urlparse(request.url).path
            name = path.split("/")[-1] if path else "imported_dataset.csv"
            if not name.endswith(".csv"):
                name += ".csv"

        dataset_data = {
            "name": name,
            "rows": len(df),
            "columns": len(df.columns),
            "features": df.columns.tolist(),
            "data": data_records,
        }
        datasets[dataset_id] = dataset_data

        # Persist to disk
        _save_dataset(dataset_id, dataset_data)

        return {
            "message": "Dataset imported successfully",
            "dataset_id": dataset_id,
            "name": name,
            "rows": len(df),
            "columns": len(df.columns),
            "features": df.columns.tolist(),
        }

    except requests.exceptions.Timeout:
        raise HTTPException(status_code=408, detail="Request timeout while fetching URL")
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {str(e)}")
    except pd.errors.ParserError as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


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
        _delete_dataset_file(dataset_id)
        _delete_dataset_snapshots(dataset_id)
        return {"message": "Dataset deleted", "dataset_id": dataset_id}
    return {"error": "Dataset not found"}


@router.get("/{dataset_id}/quality")
async def analyze_data_quality(dataset_id: str, iqr_multiplier: float = 1.5):
    """Return data quality analysis for dataset.

    Args:
        dataset_id: The dataset ID
        iqr_multiplier: IQR multiplier for outlier detection (default 1.5).
                       Higher values = fewer outliers. Common: 1.5, 2.0, 3.0
    """
    if dataset_id not in datasets:
        return {"error": "Dataset not found"}

    try:
        df = pd.DataFrame(datasets[dataset_id]["data"])
        analysis = DataQualityService.analyze_data_quality(df, iqr_multiplier=iqr_multiplier)
        return analysis
    except Exception as e:
        return {"error": f"Failed to analyze data quality: {str(e)}"}


@router.get("/{dataset_id}/rows")
async def get_dataset_rows(dataset_id: str, page: int = 1, page_size: int = 50, iqr_multiplier: float = 1.5):
    """Return paginated rows with issue highlighting."""
    if dataset_id not in datasets:
        return {"error": "Dataset not found"}

    try:
        df = pd.DataFrame(datasets[dataset_id]["data"])
        total_rows = len(df)
        total_pages = (total_rows + page_size - 1) // page_size if total_rows > 0 else 1

        start_idx = (page - 1) * page_size
        end_idx = min(start_idx + page_size, total_rows)

        # Get analysis for highlighting
        analysis = DataQualityService.analyze_data_quality(df, iqr_multiplier=iqr_multiplier)

        # Build row_issues map: {row_index: [issue_types]}
        row_issues = {}
        for idx in analysis["issues"]["duplicate_rows"]["row_indices"]:
            if start_idx <= idx < end_idx:
                row_issues.setdefault(str(idx), []).append("duplicate")

        for col_info in analysis["columns"]:
            for idx in col_info["outlier_indices"]:
                if start_idx <= idx < end_idx:
                    row_issues.setdefault(str(idx), []).append("outlier")

        page_df = df.iloc[start_idx:end_idx]

        # Convert to records and clean NaN values
        def clean_record(record):
            return {k: (None if pd.isna(v) else v) for k, v in record.items()}

        rows_data = [clean_record(r) for r in page_df.to_dict(orient="records")]

        return {
            "rows": rows_data,
            "columns": df.columns.tolist(),
            "total_rows": total_rows,
            "total_pages": total_pages,
            "start_index": start_idx,
            "end_index": end_idx,
            "row_issues": row_issues
        }
    except Exception as e:
        return {"error": f"Failed to load rows: {str(e)}"}


@router.post("/{dataset_id}/clean")
async def clean_dataset(dataset_id: str, request: CleaningRequest):
    """Apply cleaning operations to dataset (in-place modification)."""
    if dataset_id not in datasets:
        return {"error": "Dataset not found"}

    # Save snapshot before cleaning (for undo)
    operation_descriptions = []
    for op in request.operations:
        if op.type == "fill_missing":
            operation_descriptions.append(f"Fill {op.column} with {op.strategy}")
        elif op.type == "delete_column":
            operation_descriptions.append(f"Delete column {op.column}")
        elif op.type == "delete_rows":
            operation_descriptions.append(f"Delete {len(op.indices or [])} rows")
        elif op.type == "remove_duplicates":
            operation_descriptions.append("Remove duplicates")
        elif op.type == "remove_outliers":
            operation_descriptions.append(f"Remove outliers from {op.column}")

    description = "; ".join(operation_descriptions) if operation_descriptions else "Cleaning operation"
    snapshot_id = _save_snapshot(dataset_id, datasets[dataset_id].copy(), f"Before: {description}")

    df = pd.DataFrame(datasets[dataset_id]["data"])

    operations = [op.dict() for op in request.operations]
    cleaned_df, summary = DataQualityService.apply_cleaning_operations(df, operations)

    # Convert to records and clean NaN values
    def clean_record(record):
        return {k: (None if pd.isna(v) else v) for k, v in record.items()}

    # Update in-memory dataset
    datasets[dataset_id]["data"] = [clean_record(r) for r in cleaned_df.to_dict(orient="records")]
    datasets[dataset_id]["rows"] = len(cleaned_df)
    datasets[dataset_id]["columns"] = len(cleaned_df.columns)
    datasets[dataset_id]["features"] = cleaned_df.columns.tolist()

    # Persist changes to disk
    _save_dataset(dataset_id, datasets[dataset_id])

    return {
        "message": "Cleaning operations applied",
        "summary": summary,
        "snapshot_id": snapshot_id
    }


@router.post("/{dataset_id}/engineer")
async def engineer_feature(dataset_id: str, request: FeatureEngineerRequest):
    """Add an engineered feature to the dataset."""
    if dataset_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Build params dict based on operation type
    params = {}
    if request.new_column_name:
        params["new_column_name"] = request.new_column_name

    if request.operation_type == "rolling_average":
        if not request.column or not request.window:
            raise HTTPException(status_code=400, detail="rolling_average requires column and window")
        params["column"] = request.column
        params["window"] = request.window

    elif request.operation_type == "ratio":
        if not request.numerator or not request.denominator:
            raise HTTPException(status_code=400, detail="ratio requires numerator and denominator")
        params["numerator"] = request.numerator
        params["denominator"] = request.denominator

    elif request.operation_type == "difference":
        if not request.column1 or not request.column2:
            raise HTTPException(status_code=400, detail="difference requires column1 and column2")
        params["column1"] = request.column1
        params["column2"] = request.column2

    elif request.operation_type == "percentage_change":
        if not request.column:
            raise HTTPException(status_code=400, detail="percentage_change requires column")
        params["column"] = request.column
        params["periods"] = request.periods or 1

    elif request.operation_type == "lag":
        if not request.column:
            raise HTTPException(status_code=400, detail="lag requires column")
        params["column"] = request.column
        params["periods"] = request.periods or 1

    elif request.operation_type == "product":
        if not request.column1 or not request.column2:
            raise HTTPException(status_code=400, detail="product requires column1 and column2")
        params["column1"] = request.column1
        params["column2"] = request.column2

    else:
        raise HTTPException(status_code=400, detail=f"Unknown operation type: {request.operation_type}")

    try:
        # Save snapshot before engineering (for undo)
        _save_snapshot(dataset_id, datasets[dataset_id].copy(), f"Before: Add {request.operation_type} feature")

        df = pd.DataFrame(datasets[dataset_id]["data"])
        result_df, new_column = FeatureEngineeringService.apply_operation(
            df, request.operation_type, params
        )

        # Convert to records and clean NaN values
        def clean_record(record):
            return {k: (None if pd.isna(v) else v) for k, v in record.items()}

        # Update in-memory dataset
        datasets[dataset_id]["data"] = [clean_record(r) for r in result_df.to_dict(orient="records")]
        datasets[dataset_id]["columns"] = len(result_df.columns)
        datasets[dataset_id]["features"] = result_df.columns.tolist()

        # Persist to disk
        _save_dataset(dataset_id, datasets[dataset_id])

        return {
            "message": f"Feature '{new_column}' added successfully",
            "new_column": new_column,
            "total_columns": len(result_df.columns)
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{dataset_id}/date-columns")
async def get_date_columns(dataset_id: str):
    """Return list of columns that can be used as date columns for time-based splits."""
    if dataset_id not in datasets:
        return {"error": "Dataset not found"}

    df = pd.DataFrame(datasets[dataset_id]["data"])
    date_columns = ValidationService.detect_date_columns(df)

    return {"date_columns": date_columns}


@router.get("/{dataset_id}/correlations")
async def get_feature_correlations(dataset_id: str, threshold: float = 0.7):
    """Return highly correlated feature pairs.

    Args:
        dataset_id: The dataset ID
        threshold: Correlation threshold (0-1). Default 0.7 means features
                  with |correlation| >= 0.7 will be flagged.
    """
    if dataset_id not in datasets:
        return {"error": "Dataset not found"}

    try:
        df = pd.DataFrame(datasets[dataset_id]["data"])

        # Select only numeric columns
        numeric_df = df.select_dtypes(include=[np.number])

        if len(numeric_df.columns) < 2:
            return {"correlations": [], "high_correlations": []}

        # Calculate correlation matrix
        corr_matrix = numeric_df.corr()

        # Find highly correlated pairs (above threshold)
        high_correlations = []
        seen_pairs = set()

        for i, col1 in enumerate(corr_matrix.columns):
            for j, col2 in enumerate(corr_matrix.columns):
                if i >= j:  # Skip diagonal and lower triangle
                    continue

                corr_value = corr_matrix.iloc[i, j]

                # Skip NaN correlations
                if pd.isna(corr_value):
                    continue

                pair_key = tuple(sorted([col1, col2]))
                if pair_key in seen_pairs:
                    continue
                seen_pairs.add(pair_key)

                if abs(corr_value) >= threshold:
                    high_correlations.append({
                        "feature1": col1,
                        "feature2": col2,
                        "correlation": round(float(corr_value), 4),
                        "strength": "strong" if abs(corr_value) >= 0.9 else "moderate"
                    })

        # Sort by absolute correlation (highest first)
        high_correlations.sort(key=lambda x: abs(x["correlation"]), reverse=True)

        return {
            "correlations": high_correlations,
            "threshold": threshold,
            "total_numeric_features": len(numeric_df.columns)
        }
    except Exception as e:
        return {"error": f"Failed to calculate correlations: {str(e)}"}


@router.get("/{dataset_id}/visualization")
async def get_dataset_visualization(dataset_id: str, column: Optional[str] = None):
    """Get visualization data for dataset columns (histograms, scatter data)."""
    if dataset_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    df = pd.DataFrame(datasets[dataset_id]["data"])
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

    result = {
        "dataset_id": dataset_id,
        "numeric_columns": numeric_cols,
        "histograms": {},
        "scatter_pairs": [],
    }

    # Generate histograms for numeric columns
    cols_to_process = [column] if column and column in numeric_cols else numeric_cols[:10]  # Limit to 10 columns
    for col in cols_to_process:
        try:
            col_data = df[col].dropna()
            if len(col_data) == 0:
                continue

            # Create histogram bins
            counts, bin_edges = np.histogram(col_data, bins=20)
            histogram_data = []
            for i in range(len(counts)):
                bin_label = f"{bin_edges[i]:.2f}-{bin_edges[i+1]:.2f}"
                histogram_data.append({
                    "range": bin_label,
                    "count": int(counts[i]),
                    "min": float(bin_edges[i]),
                    "max": float(bin_edges[i+1])
                })
            result["histograms"][col] = histogram_data
        except Exception:
            pass

    # Generate scatter plot pairs (first 5 numeric columns)
    if len(numeric_cols) >= 2:
        scatter_cols = numeric_cols[:5]
        for i in range(len(scatter_cols)):
            for j in range(i + 1, len(scatter_cols)):
                col1, col2 = scatter_cols[i], scatter_cols[j]
                try:
                    # Sample if too many points
                    sample_df = df[[col1, col2]].dropna()
                    if len(sample_df) > 500:
                        sample_df = sample_df.sample(500, random_state=42)

                    scatter_data = [
                        {"x": float(row[col1]), "y": float(row[col2])}
                        for _, row in sample_df.iterrows()
                    ]
                    result["scatter_pairs"].append({
                        "x_column": col1,
                        "y_column": col2,
                        "data": scatter_data
                    })
                except Exception:
                    pass

    return result


@router.get("/{dataset_id}/history")
async def get_dataset_history(dataset_id: str):
    """Get the undo history (snapshots) for a dataset."""
    if dataset_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    snapshots = dataset_snapshots.get(dataset_id, [])
    # Return in reverse order (most recent first)
    return {
        "dataset_id": dataset_id,
        "snapshots": list(reversed(snapshots))
    }


@router.post("/{dataset_id}/restore/{snapshot_id}")
async def restore_dataset_snapshot(dataset_id: str, snapshot_id: str):
    """Restore a dataset to a previous snapshot state."""
    if dataset_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Check if snapshot exists
    if dataset_id not in dataset_snapshots:
        raise HTTPException(status_code=404, detail="No snapshots found for this dataset")

    snapshot_meta = None
    for snap in dataset_snapshots[dataset_id]:
        if snap["id"] == snapshot_id:
            snapshot_meta = snap
            break

    if not snapshot_meta:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    # Load the snapshot data
    snapshot_data = _load_snapshot(dataset_id, snapshot_id)
    if not snapshot_data:
        raise HTTPException(status_code=404, detail="Snapshot data not found")

    # Save current state as a new snapshot before restoring (so restore itself can be undone)
    _save_snapshot(dataset_id, datasets[dataset_id].copy(), "Before restore")

    # Restore the dataset
    datasets[dataset_id] = snapshot_data
    _save_dataset(dataset_id, datasets[dataset_id])

    return {
        "message": "Dataset restored to snapshot",
        "dataset_id": dataset_id,
        "snapshot_id": snapshot_id,
        "rows": snapshot_data["rows"],
        "columns": snapshot_data["columns"]
    }
