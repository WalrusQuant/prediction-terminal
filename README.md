# Prediction Terminal

A comprehensive ML platform for building, training, and deploying predictive models for sports analytics. Features a terminal-styled web interface with advanced data quality analysis, feature engineering, model ensembling, and hyperparameter tuning.

## Quick Start

### Backend (Python + FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend runs at http://localhost:8000

### Frontend (React + TypeScript)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:5173

## Features

### Data Management
- **CSV Upload**: Upload datasets in CSV format
- **URL Import**: Load datasets directly from URLs
- **Data Preview**: View paginated data with sortable columns
- **Column Statistics**: See dtype, null counts, unique values, min/max/mean for each column
- **Dataset Deletion**: Remove datasets when no longer needed

### Data Quality Analysis
- **Missing Value Detection**: Identify and quantify null values per column
- **Duplicate Detection**: Find and highlight duplicate rows
- **Outlier Detection**: IQR-based outlier identification with configurable multiplier
- **Issue Highlighting**: Visual indicators for problematic cells in data viewer
- **Quality Reports**: Comprehensive data quality summaries

### Data Cleaning
- **Fill Missing Values**: Impute with median, mean, or mode
- **Remove Duplicates**: Eliminate duplicate rows
- **Remove Outliers**: Clean outliers based on IQR thresholds
- **Delete Columns/Rows**: Remove unwanted data
- **Snapshot/Undo System**: Full history with restore capability (keeps last 10 snapshots)

### Feature Engineering
- **Rolling Average**: Create moving averages over configurable windows
- **Ratio**: Calculate ratios between columns
- **Difference**: Compute differences between columns
- **Percentage Change**: Calculate percent changes
- **Lag Features**: Create time-lagged versions of columns
- **Product Features**: Multiply columns together

### Data Visualization
- **Histograms**: Distribution visualization for numeric columns
- **Scatter Plots**: Explore relationships between feature pairs
- **Correlation Analysis**: Feature correlation matrix with multicollinearity warnings

### Model Training
- **Multiple Algorithms**:
  - Linear Regression - Simple and interpretable
  - Random Forest - Good for most datasets
  - XGBoost - High performance gradient boosting
- **Feature Selection**: Choose which columns to use as input features
- **Target Selection**: Select the variable you want to predict
- **Split Strategies**:
  - Random Split - Standard 80/20 train/test split
  - Time-Based Split - Chronological splitting for time series
  - Walk-Forward Cross-Validation - Rolling window validation

### Feature Analysis
- **Correlation Analysis**: See how each feature correlates with your target variable
- **Leakage Detection**: Automatic warnings for features with suspiciously high correlation (>0.85)
- **Smart Recommendations**: Features classified as Good, Moderate, Weak, Caution, or Avoid
- **One-Click Selection**: "Select Recommended" to quickly choose optimal features
- **Informed Decisions**: Understand which features will actually help your model

### Model Analytics
- **Performance Metrics**:
  - R² Score (coefficient of determination)
  - RMSE (root mean squared error)
  - MAE (mean absolute error)
  - MSE (mean squared error)
  - Train vs Test R² comparison
- **Visualizations**:
  - Actual vs Predicted scatter plot with perfect prediction reference line
  - Residual (error) distribution histogram
  - Feature importance bar chart
  - Walk-forward CV fold results
- **Model Summary**: Full configuration details, metrics, and feature list
- **Favorite Models**: Mark frequently used models for quick access

### Model Ensembling
- **Compatible Model Grouping**: Automatically groups models with same target/features
- **Ensemble Methods**:
  - Weighted Average - Custom weight per model
  - Median Ensemble - Robust to outlier predictions
- **Ensemble Statistics**:
  - Model disagreement metrics
  - Prediction variability
  - Inter-model correlation

### Predictions
- **Single Predictions**: Enter feature values manually with confidence intervals
- **Batch Predictions**: Upload CSV file for bulk predictions
- **Confidence Intervals**: Uncertainty quantification for predictions
- **Prediction Templates**: Save and reuse input configurations
- **Prediction History**: View all past predictions with model name, inputs, and results

### Accuracy Tracking
- **Actual Value Updates**: Record actual outcomes for predictions
- **Error Calculation**: Automatic error computation when actuals are provided
- **Accuracy Dashboard**:
  - Overall metrics (MAE, RMSE)
  - Per-model accuracy breakdown
  - Prediction count tracking

## Project Structure

```
prediction-terminal/
├── backend/
│   ├── app/
│   │   ├── main.py                    # FastAPI application
│   │   ├── routers/
│   │   │   ├── data.py                # Dataset management (14 endpoints)
│   │   │   ├── models.py              # ML model training & management
│   │   │   ├── predictions.py         # Predictions & accuracy tracking
│   │   │   └── templates.py           # Prediction input templates
│   │   └── services/
│   │       ├── ml_service.py          # Core ML training & inference
│   │       ├── data_quality_service.py    # Data quality analysis
│   │       ├── feature_engineering_service.py  # Feature creation
│   │       ├── ensemble_service.py    # Model ensemble predictions
│   │       ├── tuning_service.py      # Hyperparameter optimization
│   │       ├── preprocessing_service.py   # Data preprocessing pipeline
│   │       └── validation_service.py  # Time-aware validation strategies
│   ├── trained_models/                # Persisted model files (.pkl)
│   ├── datasets/                      # Stored datasets (JSON)
│   ├── snapshots/                     # Dataset snapshots for undo
│   ├── models_metadata.json           # Model registry
│   ├── predictions.json               # Prediction history
│   ├── templates.json                 # Saved prediction templates
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.tsx            # Navigation sidebar
│   │   │   ├── DataPanel.tsx          # Dataset list & upload
│   │   │   ├── DatasetDetailModal.tsx # Dataset preview & stats
│   │   │   ├── DataEditorModal.tsx    # Data quality, cleaning & engineering
│   │   │   ├── DataVisualizationModal.tsx  # Histograms & scatter plots
│   │   │   ├── ImportUrlModal.tsx     # Import datasets from URL
│   │   │   ├── FeatureEngineerModal.tsx    # Feature creation interface
│   │   │   ├── TrainModelModal.tsx    # Model training configuration
│   │   │   ├── ModelsTable.tsx        # Models list with metrics
│   │   │   ├── ModelDetailModal.tsx   # Model analytics & charts
│   │   │   ├── ModelCompareModal.tsx  # Side-by-side model comparison
│   │   │   ├── EnsembleModal.tsx      # Model ensemble predictions
│   │   │   ├── PredictModal.tsx       # Single & batch prediction input
│   │   │   ├── PredictionsTable.tsx   # Prediction history
│   │   │   ├── QuickPredictBar.tsx    # Quick prediction for pinned model
│   │   │   ├── AccuracyDashboard.tsx  # Prediction accuracy metrics
│   │   │   └── Toast.tsx              # Notification system
│   │   ├── api/
│   │   │   └── client.ts              # API client functions
│   │   ├── App.tsx                    # Main application
│   │   └── index.css                  # Terminal theme styles
│   └── package.json
└── README.md
```

## API Endpoints

### Data (14 endpoints)
- `GET /api/data/` - List all datasets
- `POST /api/data/upload` - Upload CSV file
- `POST /api/data/import-url` - Import dataset from URL
- `GET /api/data/{id}` - Get dataset details with preview
- `GET /api/data/{id}/stats` - Get column statistics
- `GET /api/data/{id}/quality` - Get data quality analysis
- `GET /api/data/{id}/rows` - Get paginated rows with issue highlighting
- `POST /api/data/{id}/clean` - Apply cleaning operations
- `POST /api/data/{id}/engineer` - Apply feature engineering
- `GET /api/data/{id}/date-columns` - Detect date columns
- `GET /api/data/{id}/correlations` - Get feature correlations
- `GET /api/data/{id}/visualization` - Get visualization data
- `GET /api/data/{id}/history` - Get undo history
- `POST /api/data/{id}/restore/{snapshot_id}` - Restore from snapshot
- `DELETE /api/data/{id}` - Delete dataset

### Models (10 endpoints)
- `GET /api/models/` - List all models
- `POST /api/models/` - Train new model
- `GET /api/models/{id}` - Get model info
- `GET /api/models/{id}/detail` - Get model with visualization data
- `PATCH /api/models/{id}/favorite` - Toggle favorite status
- `DELETE /api/models/{id}` - Delete model
- `POST /api/models/ensemble/predict` - Create ensemble prediction
- `GET /api/models/ensemble/compatible` - Get compatible model groups
- `POST /api/models/tune` - Run hyperparameter tuning
- `GET /api/models/tune/recommendations/{model_type}` - Get tuning recommendations

### Predictions (7 endpoints)
- `GET /api/predictions/` - List prediction history
- `POST /api/predictions/single` - Create single prediction
- `POST /api/predictions/batch` - Create batch predictions
- `PATCH /api/predictions/{id}/actual` - Update actual value
- `GET /api/predictions/accuracy` - Get accuracy statistics
- `DELETE /api/predictions/{id}` - Delete prediction
- `DELETE /api/predictions/` - Clear all predictions

### Templates (5 endpoints)
- `GET /api/templates/` - List templates
- `GET /api/templates/{id}` - Get template
- `POST /api/templates/` - Create template
- `PUT /api/templates/{id}` - Update template
- `DELETE /api/templates/{id}` - Delete template

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Recharts, dnd-kit
- **Backend**: Python, FastAPI, scikit-learn, XGBoost, pandas, NumPy

## Screenshots

The application features a dark terminal-themed UI with:
- Cyan accents for primary actions and positive metrics
- Green for success states and good model performance
- Yellow for warnings and error metrics
- Red for delete actions and poor performance indicators

## Usage Workflow

1. **Upload Data**: Go to Data tab and upload a CSV file or import from URL
2. **Analyze Quality**: Use data editor to check for missing values, duplicates, and outliers
3. **Clean Data**: Apply cleaning operations (fill missing, remove duplicates/outliers)
4. **Engineer Features**: Create new features (rolling averages, ratios, lags, etc.)
5. **Analyze Features**: Select target, click "Analyze" to see correlations and detect potential data leakage
6. **Select Features**: Use recommendations to choose features, or "Select Recommended" for optimal selection
7. **Train Model**: Choose model type and split strategy, then train
8. **Review Model**: View detailed analytics, feature importance, and performance charts
9. **Compare Models**: Use model comparison to evaluate multiple models side-by-side
10. **Create Ensembles**: Combine compatible models for improved predictions
11. **Make Predictions**: Enter data manually or upload CSV; save templates for reuse
12. **Track Accuracy**: Update predictions with actual values to monitor model performance
