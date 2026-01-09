# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Prediction Terminal is a terminal-styled web application for building and deploying predictive ML models for sports analytics. It consists of a Python/FastAPI backend and a React/TypeScript frontend.

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
- `backend/app/main.py` - FastAPI application entry point with CORS configuration
- `backend/app/routers/` - API route handlers:
  - `data.py` - Dataset upload, stats, deletion
  - `models.py` - ML model training and management
  - `predictions.py` - Single and batch predictions
- `backend/app/services/ml_service.py` - Core ML logic: training (Linear Regression, Random Forest, XGBoost), model persistence (.pkl files), and inference
- `backend/trained_models/` - Persisted model files (gitignored)
- `backend/models_metadata.json` - Model registry

### Frontend Structure
- `frontend/src/App.tsx` - Main application with tab-based navigation (Data, Models, Predictions)
- `frontend/src/api/client.ts` - API client functions for all backend endpoints
- `frontend/src/components/` - React components for each feature:
  - `DataPanel.tsx` / `DatasetDetailModal.tsx` - Dataset management
  - `ModelsTable.tsx` / `ModelDetailModal.tsx` / `TrainModelModal.tsx` - Model management and analytics
  - `PredictModal.tsx` / `PredictionsTable.tsx` - Prediction interface

### Data Flow
1. User uploads CSV via DataPanel -> stored in backend
2. User selects dataset and trains model via TrainModelModal -> MLService trains and persists model
3. User makes predictions via PredictModal -> MLService loads model and returns predictions

### API Base URL
Frontend expects backend at `http://localhost:8000/api`. CORS is configured for localhost:5173 and localhost:3000.

## Tech Stack
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Recharts
- **Backend**: Python, FastAPI, scikit-learn, XGBoost, pandas, NumPy
