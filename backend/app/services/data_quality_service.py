"""
Data quality analysis and cleaning service.
Provides functions to analyze data quality issues and apply cleaning operations.
"""

from typing import Dict, Any, List, Tuple
import pandas as pd
import numpy as np


class DataQualityService:
    @staticmethod
    def analyze_data_quality(df: pd.DataFrame, iqr_multiplier: float = 1.5) -> Dict[str, Any]:
        """
        Analyze data quality and return detailed report.

        Detects:
        - Missing values per column
        - Duplicate rows
        - Constant columns (only one unique value)
        - Outliers (IQR method for numeric columns)

        Args:
            df: DataFrame to analyze
            iqr_multiplier: Multiplier for IQR outlier detection (default 1.5).
                           Higher values = fewer outliers detected.
                           Common values: 1.5 (standard), 2.0 (moderate), 3.0 (lenient)

        Returns:
            Dictionary with quality analysis results
        """
        # Convert columns to numeric where possible (JSON loading may store numbers as strings)
        df = df.copy()
        for col in df.columns:
            if df[col].dtype == 'object':
                original_non_null = df[col].notna().sum()
                converted = pd.to_numeric(df[col], errors='coerce')
                converted_non_null = converted.notna().sum()
                if original_non_null > 0 and converted_non_null >= original_non_null * 0.5:
                    df[col] = converted

        total_rows = len(df)
        total_cols = len(df.columns)

        columns_analysis = []
        columns_with_missing = []
        constant_columns = []
        columns_with_outliers = []

        for col in df.columns:
            missing_count = int(df[col].isnull().sum())
            missing_percent = round((missing_count / total_rows) * 100, 2) if total_rows > 0 else 0
            unique_count = int(df[col].nunique(dropna=True))
            is_constant = unique_count <= 1

            # Determine column type
            is_numeric = pd.api.types.is_numeric_dtype(df[col])
            col_type = "numeric" if is_numeric else "categorical"

            # Detect outliers using IQR method for numeric columns (skip boolean)
            outlier_count = 0
            outlier_indices = []
            is_boolean = df[col].dtype == 'bool' or set(df[col].dropna().unique()).issubset({True, False, 0, 1})
            if is_numeric and not is_constant and not is_boolean:
                col_data = df[col].dropna()
                if len(col_data) > 0:
                    try:
                        Q1 = float(col_data.quantile(0.25))
                        Q3 = float(col_data.quantile(0.75))
                        IQR = Q3 - Q1
                        lower_bound = Q1 - iqr_multiplier * IQR
                        upper_bound = Q3 + iqr_multiplier * IQR
                        outlier_mask = (df[col] < lower_bound) | (df[col] > upper_bound)
                        outlier_count = int(outlier_mask.sum())
                        outlier_indices = df.index[outlier_mask].tolist()[:100]  # Limit for performance
                    except (TypeError, ValueError):
                        # Skip if quantile calculation fails (e.g., for non-comparable types)
                        pass

            columns_analysis.append({
                "name": col,
                "dtype": str(df[col].dtype),
                "type": col_type,
                "missing_count": missing_count,
                "missing_percent": missing_percent,
                "unique_count": unique_count,
                "is_constant": is_constant,
                "outlier_count": outlier_count,
                "outlier_indices": outlier_indices
            })

            if missing_count > 0:
                columns_with_missing.append(col)
            if is_constant:
                constant_columns.append(col)
            if outlier_count > 0:
                columns_with_outliers.append(col)

        # Find duplicate rows
        duplicate_mask = df.duplicated(keep='first')
        duplicate_count = int(duplicate_mask.sum())
        duplicate_indices = df.index[duplicate_mask].tolist()[:100]  # Limit for performance

        # Calculate summary
        total_missing_cells = sum(col["missing_count"] for col in columns_analysis)
        total_cells = total_rows * total_cols
        missing_cell_percent = round((total_missing_cells / total_cells) * 100, 2) if total_cells > 0 else 0

        has_issues = (
            total_missing_cells > 0 or
            duplicate_count > 0 or
            len(constant_columns) > 0 or
            len(columns_with_outliers) > 0
        )

        return {
            "total_rows": total_rows,
            "total_columns": total_cols,
            "columns": columns_analysis,
            "issues": {
                "duplicate_rows": {
                    "count": duplicate_count,
                    "row_indices": duplicate_indices
                },
                "columns_with_missing": columns_with_missing,
                "constant_columns": constant_columns,
                "columns_with_outliers": columns_with_outliers
            },
            "summary": {
                "total_missing_cells": total_missing_cells,
                "missing_cell_percent": missing_cell_percent,
                "has_issues": has_issues
            }
        }

    @staticmethod
    def apply_cleaning_operations(
        df: pd.DataFrame,
        operations: List[Dict[str, Any]]
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Apply a list of cleaning operations to DataFrame.

        Supported operations:
        - fill_missing: Fill missing values in a column (strategy: median, mean, mode)
        - delete_column: Remove a column
        - delete_rows: Remove rows by indices
        - remove_duplicates: Remove duplicate rows (keep first)
        - remove_outliers: Remove rows containing outliers in specified column (IQR method)

        Args:
            df: DataFrame to clean
            operations: List of operation dictionaries

        Returns:
            Tuple of (cleaned_df, summary of changes)
        """
        df = df.copy()

        # Convert columns to numeric where possible (JSON loading may store numbers as strings)
        for col in df.columns:
            if df[col].dtype == 'object':
                original_non_null = df[col].notna().sum()
                converted = pd.to_numeric(df[col], errors='coerce')
                converted_non_null = converted.notna().sum()
                if original_non_null > 0 and converted_non_null >= original_non_null * 0.5:
                    df[col] = converted

        summary = {
            "rows_before": len(df),
            "columns_before": len(df.columns),
            "operations_applied": []
        }

        for op in operations:
            op_type = op.get("type")

            if op_type == "fill_missing":
                column = op.get("column")
                strategy = op.get("strategy", "median")

                if column in df.columns:
                    missing_before = int(df[column].isnull().sum())

                    if strategy == "median" and pd.api.types.is_numeric_dtype(df[column]):
                        df[column] = df[column].fillna(df[column].median())
                    elif strategy == "mean" and pd.api.types.is_numeric_dtype(df[column]):
                        df[column] = df[column].fillna(df[column].mean())
                    elif strategy == "mode":
                        mode_val = df[column].mode()
                        if len(mode_val) > 0:
                            df[column] = df[column].fillna(mode_val[0])

                    summary["operations_applied"].append({
                        "type": "fill_missing",
                        "column": column,
                        "strategy": strategy,
                        "cells_filled": missing_before
                    })

            elif op_type == "delete_column":
                column = op.get("column")
                if column in df.columns:
                    df = df.drop(column, axis=1)
                    summary["operations_applied"].append({
                        "type": "delete_column",
                        "column": column
                    })

            elif op_type == "delete_rows":
                indices = op.get("indices", [])
                valid_indices = [i for i in indices if i in df.index]
                if valid_indices:
                    df = df.drop(valid_indices)
                    summary["operations_applied"].append({
                        "type": "delete_rows",
                        "rows_deleted": len(valid_indices)
                    })

            elif op_type == "remove_duplicates":
                rows_before = len(df)
                df = df.drop_duplicates(keep='first')
                rows_removed = rows_before - len(df)
                summary["operations_applied"].append({
                    "type": "remove_duplicates",
                    "rows_removed": rows_removed
                })

            elif op_type == "remove_outliers":
                column = op.get("column")
                if column in df.columns and pd.api.types.is_numeric_dtype(df[column]):
                    col_data = df[column].dropna()
                    if len(col_data) > 0:
                        Q1 = col_data.quantile(0.25)
                        Q3 = col_data.quantile(0.75)
                        IQR = Q3 - Q1
                        lower_bound = Q1 - 1.5 * IQR
                        upper_bound = Q3 + 1.5 * IQR

                        rows_before = len(df)
                        # Keep rows that are within bounds or have NaN (don't remove missing values)
                        df = df[
                            (df[column].isna()) |
                            ((df[column] >= lower_bound) & (df[column] <= upper_bound))
                        ]
                        rows_removed = rows_before - len(df)
                        summary["operations_applied"].append({
                            "type": "remove_outliers",
                            "column": column,
                            "rows_removed": rows_removed
                        })

        # Reset index after row operations
        df = df.reset_index(drop=True)

        summary["rows_after"] = len(df)
        summary["columns_after"] = len(df.columns)

        return df, summary
