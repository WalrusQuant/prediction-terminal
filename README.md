# prediction-terminal

A terminal-styled web application for building and deploying predictive ML models for sports analytics.

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
- **Data Preview**: View first 10 rows of uploaded data
- **Column Statistics**: See dtype, null counts, unique values, min/max/mean for each column
- **Dataset Deletion**: Remove datasets when no longer needed

### Model Training
- **Multiple Algorithms**:
  - Linear Regression - Simple and interpretable
  - Random Forest - Good for most datasets
  - XGBoost - High performance gradient boosting
- **Feature Selection**: Choose which columns to use as input features
- **Target Selection**: Select the variable you want to predict
- **Automatic Train/Test Split**: 80/20 split for model validation

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
- **Model Summary**: Full configuration details, metrics, and feature list

### Predictions
- **Single Predictions**: Enter feature values manually to get one prediction
- **Batch Predictions**: Upload a CSV file to generate predictions for multiple records
- **Prediction History**: View all past predictions with model name, inputs, and results

## Project Structure

```
prediction-terminal/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI application
│   │   ├── routers/
│   │   │   ├── predictions.py   # Prediction endpoints (single & batch)
│   │   │   ├── models.py        # ML model training & management
│   │   │   └── data.py          # Dataset upload/stats/delete
│   │   └── services/
│   │       └── ml_service.py    # Core ML training & inference logic
│   ├── trained_models/          # Persisted model files (.pkl)
│   ├── models_metadata.json     # Model registry
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.tsx            # Navigation sidebar
│   │   │   ├── DataPanel.tsx          # Dataset list & upload
│   │   │   ├── DatasetDetailModal.tsx # Dataset preview & stats
│   │   │   ├── TrainModelModal.tsx    # Model training configuration
│   │   │   ├── ModelsTable.tsx        # Models list with metrics
│   │   │   ├── ModelDetailModal.tsx   # Model analytics & charts
│   │   │   ├── PredictModal.tsx       # Single & batch prediction input
│   │   │   └── PredictionsTable.tsx   # Prediction history
│   │   ├── api/
│   │   │   └── client.ts        # API client functions
│   │   ├── App.tsx              # Main application
│   │   └── index.css            # Terminal theme styles
│   └── package.json
└── README.md
```

## API Endpoints

### Data
- `GET /api/data/` - List all datasets
- `POST /api/data/upload` - Upload CSV file
- `GET /api/data/{id}` - Get dataset details with preview
- `GET /api/data/{id}/stats` - Get column statistics
- `DELETE /api/data/{id}` - Delete dataset

### Models
- `GET /api/models/` - List all models
- `POST /api/models/` - Train new model
- `GET /api/models/{id}` - Get model info
- `GET /api/models/{id}/detail` - Get model with visualization data
- `DELETE /api/models/{id}` - Delete model

### Predictions
- `GET /api/predictions/` - List prediction history
- `POST /api/predictions/single` - Create single prediction
- `POST /api/predictions/batch` - Create batch predictions
- `DELETE /api/predictions/` - Clear all predictions

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Recharts
- **Backend**: Python, FastAPI, scikit-learn, XGBoost, pandas, NumPy

## Screenshots

The application features a dark terminal-themed UI with:
- Cyan accents for primary actions and positive metrics
- Green for success states and good model performance
- Yellow for warnings and error metrics
- Red for delete actions and poor performance indicators

## Usage Workflow

1. **Upload Data**: Go to Data tab and upload a CSV file
2. **Explore Dataset**: Click "View" to see column stats and data preview
3. **Train Model**: Click "Use" to open training modal, select features and target
4. **Review Model**: Go to Models tab, click "View" to see detailed analytics
5. **Make Predictions**: Click "Predict" to enter new data or upload CSV for batch predictions
6. **View Results**: Go to Predictions tab to see all prediction history
