# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Prediction Terminal is a comprehensive ML platform for building, training, and deploying predictive models for sports analytics. It features a terminal-styled web interface with data quality analysis, feature engineering, feature correlation analysis, model ensembling, and prediction tracking. The application consists of a Python/FastAPI backend and a React/TypeScript frontend.

## Development Commands

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
npm run dev      # Development server at http://localhost:5173
npm run build    # Build for production (runs tsc -b && vite build)
npm run lint     # ESLint
```

## Architecture

### Backend Structure

#### Entry Point
- `backend/app/main.py` - FastAPI application with CORS configuration, global exception handler, and health check endpoint

#### Routers (API Route Handlers)
- `backend/app/routers/data.py` - Dataset management (14 endpoints): upload, import from URL, stats, quality analysis, cleaning, feature engineering, visualization, correlations, history/snapshots
- `backend/app/routers/models.py` - ML model operations (10 endpoints): training, management, ensemble predictions, feature analysis
- `backend/app/routers/predictions.py` - Prediction operations (7 endpoints): single/batch predictions, accuracy tracking, actual value updates
- `backend/app/routers/templates.py` - Prediction input templates (5 endpoints): save/load reusable input configurations

#### Services (Core Business Logic)
- `backend/app/services/ml_service.py` - Core ML training and inference: model training with preprocessing pipeline, walk-forward CV, feature importance, confidence intervals, model persistence
- `backend/app/services/data_quality_service.py` - Data quality analysis: missing values, duplicates, constant columns, IQR-based outlier detection, cleaning operations
- `backend/app/services/feature_engineering_service.py` - Feature creation: rolling average, ratio, difference, percentage change, lag features, product features
- `backend/app/services/ensemble_service.py` - Model ensembling: weighted and median ensemble predictions, disagreement metrics, model correlation
- `backend/app/services/tuning_service.py` - Hyperparameter optimization (disabled in UI): grid search, random search, parameter recommendations per model type
- `backend/app/services/preprocessing_service.py` - Data preprocessing pipeline: column type detection, one-hot encoding, scaling, sklearn Pipeline integration
- `backend/app/services/validation_service.py` - Time-aware validation: date column detection, time-based splits, walk-forward cross-validation

#### Storage
- `backend/trained_models/` - Persisted model files (.pkl, gitignored)
- `backend/datasets/` - Stored datasets (JSON format)
- `backend/snapshots/` - Dataset snapshots for undo (keeps last 10 per dataset)
- `backend/models_metadata.json` - Model registry
- `backend/predictions.json` - Prediction history with actuals
- `backend/templates.json` - Saved prediction templates

### Frontend Structure

#### Core Application
- `frontend/src/App.tsx` - Main application with tab-based navigation (Data, Models, Predictions), theme toggle, state management
- `frontend/src/api/client.ts` - Comprehensive TypeScript API client with interfaces for all backend endpoints

#### Components

**Data Management:**
- `DataPanel.tsx` - Dataset list, upload button, delete functionality
- `DatasetDetailModal.tsx` - Dataset preview and column statistics
- `DataEditorModal.tsx` - Paginated data viewer with quality analysis, cleaning operations, feature engineering, undo history (largest component ~1050 lines)
- `DataVisualizationModal.tsx` - Histograms and scatter plots
- `ImportUrlModal.tsx` - Import datasets from URL
- `FeatureEngineerModal.tsx` - Feature creation interface

**Model Management:**
- `TrainModelModal.tsx` - Model training with feature selection, split strategies, correlation warnings (~860 lines)
- `FeatureAnalysisModal.tsx` - Feature-target correlation analysis with leakage detection and recommendations
- `ModelsTable.tsx` - Model list with metrics, favorites, comparison
- `ModelDetailModal.tsx` - Model analytics, charts, feature importance, residuals
- `ModelCompareModal.tsx` - Side-by-side model comparison
- `EnsembleModal.tsx` - Create ensemble predictions from compatible models

**Predictions:**
- `PredictModal.tsx` - Single/batch predictions with confidence intervals and templates
- `PredictionsTable.tsx` - Prediction history with actual value updates
- `QuickPredictBar.tsx` - Quick prediction for pinned model
- `AccuracyDashboard.tsx` - Overall and per-model accuracy metrics

**UI:**
- `Sidebar.tsx` - Navigation and theme toggle
- `Toast.tsx` - Notification system
- `DraggableTableHeader.tsx` - Drag-drop column reordering (dnd-kit)

### Data Flow
1. User uploads CSV or imports from URL via DataPanel -> stored in backend datasets/
2. User analyzes data quality, cleans data, engineers features via DataEditorModal -> snapshots saved for undo
3. User selects target, uses Feature Analysis to understand correlations and select optimal features
4. User trains model via TrainModelModal -> MLService trains, validates, persists model
5. User views model analytics via ModelDetailModal -> visualizations and metrics displayed
6. User makes predictions via PredictModal -> MLService loads model, returns predictions with confidence intervals
7. User tracks accuracy via AccuracyDashboard -> actual values compared to predictions

### API Base URL
Frontend expects backend at `http://localhost:8000/api`. CORS is configured for localhost:5173 and localhost:3000.

## Key Patterns

### Backend
- **Service Layer**: Each major feature has a dedicated service class for separation of concerns
- **Preprocessing Pipelines**: sklearn Pipelines ensure reproducible preprocessing
- **Snapshot System**: Destructive data operations create snapshots for undo capability
- **Pydantic Validation**: Request/response models for type safety

### Frontend
- **Component Composition**: Large modals handle complex multi-step workflows
- **Keyboard Shortcuts**: Escape key closes modals, other shortcuts for common actions
- **Dark/Light Theme**: localStorage persistence for theme preference
- **Recharts Visualizations**: Scatter plots, bar charts, histograms for data and model visualization

## Tech Stack
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Recharts, dnd-kit
- **Backend**: Python, FastAPI, scikit-learn, XGBoost, pandas, NumPy
