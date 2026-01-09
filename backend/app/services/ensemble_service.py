"""Service for creating and managing model ensembles."""
from typing import List, Dict, Any, Optional
import numpy as np
import math


def safe_float(value: float) -> float:
    """Convert a float to a JSON-safe value, replacing NaN/Inf with 0."""
    if math.isnan(value) or math.isinf(value):
        return 0.0
    return value


class EnsembleService:
    """Service for creating ensemble predictions from multiple models."""

    @staticmethod
    def create_weighted_ensemble(
        predictions: Dict[str, List[float]],
        weights: Optional[Dict[str, float]] = None
    ) -> List[float]:
        """
        Create ensemble predictions using weighted averaging.

        Args:
            predictions: Dict mapping model_id to list of predictions
            weights: Optional dict mapping model_id to weight (0-1). If None, equal weights.

        Returns:
            List of ensemble predictions
        """
        model_ids = list(predictions.keys())
        if not model_ids:
            raise ValueError("No predictions provided")

        # Check all predictions have same length
        pred_length = len(predictions[model_ids[0]])
        for model_id in model_ids:
            if len(predictions[model_id]) != pred_length:
                raise ValueError("All models must have same number of predictions")

        # Default to equal weights
        if weights is None:
            weights = {model_id: 1.0 / len(model_ids) for model_id in model_ids}
        else:
            # Normalize weights
            total_weight = sum(weights.get(mid, 0) for mid in model_ids)
            if total_weight == 0:
                weights = {model_id: 1.0 / len(model_ids) for model_id in model_ids}
            else:
                weights = {mid: weights.get(mid, 0) / total_weight for mid in model_ids}

        # Calculate weighted average
        ensemble_predictions = []
        for i in range(pred_length):
            weighted_sum = sum(
                predictions[model_id][i] * weights[model_id]
                for model_id in model_ids
            )
            ensemble_predictions.append(round(safe_float(weighted_sum), 4))

        return ensemble_predictions

    @staticmethod
    def create_median_ensemble(predictions: Dict[str, List[float]]) -> List[float]:
        """
        Create ensemble predictions using median.

        Args:
            predictions: Dict mapping model_id to list of predictions

        Returns:
            List of ensemble predictions (median of each position)
        """
        model_ids = list(predictions.keys())
        if not model_ids:
            raise ValueError("No predictions provided")

        pred_length = len(predictions[model_ids[0]])
        for model_id in model_ids:
            if len(predictions[model_id]) != pred_length:
                raise ValueError("All models must have same number of predictions")

        ensemble_predictions = []
        for i in range(pred_length):
            values = [predictions[model_id][i] for model_id in model_ids]
            median_val = float(np.median(values))
            ensemble_predictions.append(round(safe_float(median_val), 4))

        return ensemble_predictions

    @staticmethod
    def get_ensemble_stats(
        predictions: Dict[str, List[float]],
        ensemble_predictions: List[float]
    ) -> Dict[str, Any]:
        """
        Get statistics about the ensemble.

        Args:
            predictions: Individual model predictions
            ensemble_predictions: Final ensemble predictions

        Returns:
            Dict with ensemble statistics
        """
        model_ids = list(predictions.keys())
        pred_length = len(ensemble_predictions)

        # Calculate disagreement between models
        disagreements = []
        for i in range(pred_length):
            values = [predictions[model_id][i] for model_id in model_ids]
            std_val = np.std(values)
            disagreements.append(safe_float(float(std_val)))

        avg_disagreement = safe_float(float(np.mean(disagreements))) if disagreements else 0.0
        max_disagreement = safe_float(float(np.max(disagreements))) if disagreements else 0.0

        # Calculate correlation between models
        correlations = {}
        if len(model_ids) >= 2:
            for j, mid1 in enumerate(model_ids):
                for mid2 in model_ids[j+1:]:
                    try:
                        corr_matrix = np.corrcoef(predictions[mid1], predictions[mid2])
                        corr = float(corr_matrix[0, 1])
                        # Handle NaN correlation (happens when one array has no variance)
                        corr = safe_float(corr)
                        correlations[f"{mid1}_vs_{mid2}"] = round(corr, 4)
                    except Exception:
                        correlations[f"{mid1}_vs_{mid2}"] = 0.0

        return {
            "num_models": len(model_ids),
            "num_predictions": pred_length,
            "avg_model_disagreement": round(avg_disagreement, 4),
            "max_model_disagreement": round(max_disagreement, 4),
            "model_correlations": correlations,
        }
