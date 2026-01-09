"""
Preprocessing service for building sklearn Pipelines.
Ensures consistent preprocessing between training and inference.
"""

from typing import List, Dict
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer


class PreprocessingService:
    @staticmethod
    def detect_column_types(df: pd.DataFrame, feature_columns: List[str]) -> Dict[str, List[str]]:
        """
        Classify feature columns as numeric or categorical.

        Args:
            df: DataFrame containing the data
            feature_columns: List of column names to classify

        Returns:
            Dict with 'numeric' and 'categorical' lists
        """
        numeric = []
        categorical = []

        for col in feature_columns:
            if col not in df.columns:
                continue
            if pd.api.types.is_numeric_dtype(df[col]):
                numeric.append(col)
            else:
                categorical.append(col)

        return {"numeric": numeric, "categorical": categorical}

    @staticmethod
    def build_preprocessor(
        numeric_features: List[str],
        categorical_features: List[str]
    ) -> ColumnTransformer:
        """
        Build a preprocessing ColumnTransformer.

        Numeric features: Impute with median, then scale with StandardScaler
        Categorical features: Impute with mode, then OneHotEncode

        Args:
            numeric_features: List of numeric column names
            categorical_features: List of categorical column names

        Returns:
            ColumnTransformer that can be used in a Pipeline
        """
        transformers = []

        if numeric_features:
            numeric_transformer = Pipeline(steps=[
                ('imputer', SimpleImputer(strategy='median')),
                ('scaler', StandardScaler())
            ])
            transformers.append(('num', numeric_transformer, numeric_features))

        if categorical_features:
            categorical_transformer = Pipeline(steps=[
                ('imputer', SimpleImputer(strategy='most_frequent')),
                ('onehot', OneHotEncoder(handle_unknown='ignore', sparse_output=False))
            ])
            transformers.append(('cat', categorical_transformer, categorical_features))

        preprocessor = ColumnTransformer(
            transformers=transformers,
            remainder='drop'
        )

        return preprocessor

    @staticmethod
    def build_full_pipeline(
        numeric_features: List[str],
        categorical_features: List[str],
        model
    ) -> Pipeline:
        """
        Build a complete Pipeline with preprocessing and model.

        Args:
            numeric_features: List of numeric column names
            categorical_features: List of categorical column names
            model: sklearn-compatible model instance

        Returns:
            Complete Pipeline ready for fit/predict
        """
        preprocessor = PreprocessingService.build_preprocessor(
            numeric_features, categorical_features
        )

        full_pipeline = Pipeline(steps=[
            ('preprocessor', preprocessor),
            ('model', model)
        ])

        return full_pipeline
