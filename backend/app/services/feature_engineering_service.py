"""Feature engineering service for creating derived features."""
import pandas as pd
import numpy as np
from typing import Optional, List, Tuple


class FeatureEngineeringService:
    """Service for creating derived features from existing columns."""

    @staticmethod
    def rolling_average(
        df: pd.DataFrame,
        column: str,
        window: int,
        new_column_name: Optional[str] = None
    ) -> Tuple[pd.DataFrame, str]:
        """Calculate rolling average of a column.

        Args:
            df: DataFrame
            column: Column to calculate rolling average for
            window: Window size for rolling average
            new_column_name: Optional name for new column

        Returns:
            Tuple of (modified DataFrame, new column name)
        """
        if column not in df.columns:
            raise ValueError(f"Column '{column}' not found")

        if not pd.api.types.is_numeric_dtype(df[column]):
            raise ValueError(f"Column '{column}' must be numeric")

        name = new_column_name or f"{column}_rolling_{window}"
        df[name] = df[column].rolling(window=window, min_periods=1).mean()

        return df, name

    @staticmethod
    def ratio(
        df: pd.DataFrame,
        numerator: str,
        denominator: str,
        new_column_name: Optional[str] = None
    ) -> Tuple[pd.DataFrame, str]:
        """Calculate ratio of two columns.

        Args:
            df: DataFrame
            numerator: Column to use as numerator
            denominator: Column to use as denominator
            new_column_name: Optional name for new column

        Returns:
            Tuple of (modified DataFrame, new column name)
        """
        if numerator not in df.columns:
            raise ValueError(f"Column '{numerator}' not found")
        if denominator not in df.columns:
            raise ValueError(f"Column '{denominator}' not found")

        if not pd.api.types.is_numeric_dtype(df[numerator]):
            raise ValueError(f"Column '{numerator}' must be numeric")
        if not pd.api.types.is_numeric_dtype(df[denominator]):
            raise ValueError(f"Column '{denominator}' must be numeric")

        name = new_column_name or f"{numerator}_div_{denominator}"
        # Use np.where to avoid division by zero
        df[name] = np.where(
            df[denominator] != 0,
            df[numerator] / df[denominator],
            np.nan
        )

        return df, name

    @staticmethod
    def difference(
        df: pd.DataFrame,
        column1: str,
        column2: str,
        new_column_name: Optional[str] = None
    ) -> Tuple[pd.DataFrame, str]:
        """Calculate difference between two columns.

        Args:
            df: DataFrame
            column1: First column
            column2: Second column (subtracted from first)
            new_column_name: Optional name for new column

        Returns:
            Tuple of (modified DataFrame, new column name)
        """
        if column1 not in df.columns:
            raise ValueError(f"Column '{column1}' not found")
        if column2 not in df.columns:
            raise ValueError(f"Column '{column2}' not found")

        if not pd.api.types.is_numeric_dtype(df[column1]):
            raise ValueError(f"Column '{column1}' must be numeric")
        if not pd.api.types.is_numeric_dtype(df[column2]):
            raise ValueError(f"Column '{column2}' must be numeric")

        name = new_column_name or f"{column1}_minus_{column2}"
        df[name] = df[column1] - df[column2]

        return df, name

    @staticmethod
    def percentage_change(
        df: pd.DataFrame,
        column: str,
        periods: int = 1,
        new_column_name: Optional[str] = None
    ) -> Tuple[pd.DataFrame, str]:
        """Calculate percentage change from previous row(s).

        Args:
            df: DataFrame
            column: Column to calculate percentage change for
            periods: Number of periods to look back
            new_column_name: Optional name for new column

        Returns:
            Tuple of (modified DataFrame, new column name)
        """
        if column not in df.columns:
            raise ValueError(f"Column '{column}' not found")

        if not pd.api.types.is_numeric_dtype(df[column]):
            raise ValueError(f"Column '{column}' must be numeric")

        name = new_column_name or f"{column}_pct_change_{periods}"
        df[name] = df[column].pct_change(periods=periods) * 100  # As percentage

        return df, name

    @staticmethod
    def lag(
        df: pd.DataFrame,
        column: str,
        periods: int = 1,
        new_column_name: Optional[str] = None
    ) -> Tuple[pd.DataFrame, str]:
        """Create lagged feature (previous row values).

        Args:
            df: DataFrame
            column: Column to lag
            periods: Number of periods to lag
            new_column_name: Optional name for new column

        Returns:
            Tuple of (modified DataFrame, new column name)
        """
        if column not in df.columns:
            raise ValueError(f"Column '{column}' not found")

        name = new_column_name or f"{column}_lag_{periods}"
        df[name] = df[column].shift(periods)

        return df, name

    @staticmethod
    def product(
        df: pd.DataFrame,
        column1: str,
        column2: str,
        new_column_name: Optional[str] = None
    ) -> Tuple[pd.DataFrame, str]:
        """Calculate product of two columns.

        Args:
            df: DataFrame
            column1: First column
            column2: Second column
            new_column_name: Optional name for new column

        Returns:
            Tuple of (modified DataFrame, new column name)
        """
        if column1 not in df.columns:
            raise ValueError(f"Column '{column1}' not found")
        if column2 not in df.columns:
            raise ValueError(f"Column '{column2}' not found")

        if not pd.api.types.is_numeric_dtype(df[column1]):
            raise ValueError(f"Column '{column1}' must be numeric")
        if not pd.api.types.is_numeric_dtype(df[column2]):
            raise ValueError(f"Column '{column2}' must be numeric")

        name = new_column_name or f"{column1}_times_{column2}"
        df[name] = df[column1] * df[column2]

        return df, name

    @staticmethod
    def apply_operation(
        df: pd.DataFrame,
        operation_type: str,
        params: dict
    ) -> Tuple[pd.DataFrame, str]:
        """Apply a feature engineering operation.

        Args:
            df: DataFrame
            operation_type: Type of operation (rolling_average, ratio, difference,
                           percentage_change, lag, product)
            params: Parameters for the operation

        Returns:
            Tuple of (modified DataFrame, new column name)
        """
        operations = {
            "rolling_average": FeatureEngineeringService.rolling_average,
            "ratio": FeatureEngineeringService.ratio,
            "difference": FeatureEngineeringService.difference,
            "percentage_change": FeatureEngineeringService.percentage_change,
            "lag": FeatureEngineeringService.lag,
            "product": FeatureEngineeringService.product,
        }

        if operation_type not in operations:
            raise ValueError(f"Unknown operation type: {operation_type}")

        return operations[operation_type](df, **params)
