"""
Validation service for time-aware train/test splitting.
Provides time-based split and walk-forward cross-validation strategies.
"""

from typing import List, Tuple, Optional
from enum import Enum
import pandas as pd
import numpy as np


class SplitType(str, Enum):
    RANDOM = "random"
    TIME_BASED = "time_based"
    WALK_FORWARD = "walk_forward"


class ValidationService:
    @staticmethod
    def detect_date_columns(df: pd.DataFrame) -> List[str]:
        """
        Detect columns that are dates/datetimes or can be parsed as dates.

        Args:
            df: DataFrame to analyze

        Returns:
            List of column names that contain date/datetime data
        """
        date_columns = []

        for col in df.columns:
            # Check if already datetime type
            if pd.api.types.is_datetime64_any_dtype(df[col]):
                date_columns.append(col)
                continue

            # Skip numeric columns (they might be timestamps but we'll require explicit datetime)
            if pd.api.types.is_numeric_dtype(df[col]):
                continue

            # Try to parse object columns as dates
            if df[col].dtype == 'object':
                try:
                    # Sample the first non-null values
                    sample = df[col].dropna().head(100)
                    if len(sample) == 0:
                        continue

                    # Try to parse as datetime
                    parsed = pd.to_datetime(sample, errors='coerce')

                    # If more than 80% successfully parsed, consider it a date column
                    success_rate = parsed.notna().sum() / len(sample)
                    if success_rate > 0.8:
                        date_columns.append(col)
                except Exception:
                    continue

        return date_columns

    @staticmethod
    def time_based_split(
        df: pd.DataFrame,
        date_column: str,
        test_size: float = 0.2
    ) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        Split data based on time ordering (train on earlier, test on later).

        Args:
            df: DataFrame with date column
            date_column: Name of the column containing dates
            test_size: Fraction of data to use for testing

        Returns:
            Tuple of (train_df, test_df)
        """
        # Convert to datetime if not already
        df = df.copy()
        if not pd.api.types.is_datetime64_any_dtype(df[date_column]):
            df[date_column] = pd.to_datetime(df[date_column], errors='coerce')

        # Sort by date
        df = df.sort_values(date_column).reset_index(drop=True)

        # Calculate split index
        split_idx = int(len(df) * (1 - test_size))

        train_df = df.iloc[:split_idx].copy()
        test_df = df.iloc[split_idx:].copy()

        return train_df, test_df

    @staticmethod
    def walk_forward_split(
        df: pd.DataFrame,
        date_column: str,
        n_splits: int = 5,
        test_size: float = 0.2
    ) -> List[Tuple[List[int], List[int]]]:
        """
        Generate multiple train/test windows that respect time ordering.

        This implements an expanding window approach where each fold uses
        all previous data for training and a fixed-size test window.

        Args:
            df: DataFrame with date column
            date_column: Name of the column containing dates
            n_splits: Number of CV folds
            test_size: Fraction of total data for each test window

        Returns:
            List of (train_indices, test_indices) tuples
        """
        # Convert to datetime if not already
        df = df.copy()
        if not pd.api.types.is_datetime64_any_dtype(df[date_column]):
            df[date_column] = pd.to_datetime(df[date_column], errors='coerce')

        # Sort by date
        df = df.sort_values(date_column).reset_index(drop=True)
        n_samples = len(df)

        # Calculate test window size
        test_window_size = max(int(n_samples * test_size / n_splits), 1)

        # Generate folds
        folds = []
        total_test_size = test_window_size * n_splits

        # Reserve some data for initial training (at least 20% of data)
        min_train_size = max(int(n_samples * 0.2), 10)
        available_for_test = n_samples - min_train_size

        if available_for_test < total_test_size:
            # Adjust test window size if not enough data
            test_window_size = max(available_for_test // n_splits, 1)
            total_test_size = test_window_size * n_splits

        for fold in range(n_splits):
            # Test window for this fold
            test_end = n_samples - (n_splits - fold - 1) * test_window_size
            test_start = test_end - test_window_size

            # Train on all data before test window
            train_indices = list(range(test_start))
            test_indices = list(range(test_start, test_end))

            if len(train_indices) >= 10 and len(test_indices) > 0:
                folds.append((train_indices, test_indices))

        return folds

    @staticmethod
    def get_split_info(
        df: pd.DataFrame,
        date_column: str,
        split_type: SplitType,
        n_splits: int = 5,
        test_size: float = 0.2
    ) -> dict:
        """
        Get information about how the data will be split.

        Args:
            df: DataFrame
            date_column: Date column name
            split_type: Type of split
            n_splits: Number of CV folds (for walk_forward)
            test_size: Test size fraction

        Returns:
            Dictionary with split information
        """
        if split_type == SplitType.RANDOM:
            train_size = int(len(df) * (1 - test_size))
            return {
                "split_type": "random",
                "train_samples": train_size,
                "test_samples": len(df) - train_size,
                "description": f"Random 80/20 split"
            }

        # Convert to datetime for date-based splits
        df = df.copy()
        if not pd.api.types.is_datetime64_any_dtype(df[date_column]):
            df[date_column] = pd.to_datetime(df[date_column], errors='coerce')

        df = df.sort_values(date_column)

        if split_type == SplitType.TIME_BASED:
            split_idx = int(len(df) * (1 - test_size))
            train_end_date = df.iloc[split_idx - 1][date_column]
            test_start_date = df.iloc[split_idx][date_column]

            return {
                "split_type": "time_based",
                "train_samples": split_idx,
                "test_samples": len(df) - split_idx,
                "train_end_date": str(train_end_date),
                "test_start_date": str(test_start_date),
                "description": f"Train on data before {test_start_date.strftime('%Y-%m-%d') if hasattr(test_start_date, 'strftime') else test_start_date}"
            }

        elif split_type == SplitType.WALK_FORWARD:
            folds = ValidationService.walk_forward_split(df, date_column, n_splits, test_size)
            return {
                "split_type": "walk_forward",
                "n_folds": len(folds),
                "folds": [
                    {"train_samples": len(train_idx), "test_samples": len(test_idx)}
                    for train_idx, test_idx in folds
                ],
                "description": f"Walk-forward CV with {len(folds)} folds"
            }

        return {}
