# prediction-terminal

A terminal-styled web application for building predictive models for sports.

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

## Project Structure

```
prediction-terminal/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI application
│   │   ├── routers/
│   │   │   ├── predictions.py  # Prediction endpoints
│   │   │   ├── models.py       # ML model endpoints
│   │   │   └── data.py         # Dataset upload/management
│   │   ├── models/           # ML model implementations (future)
│   │   └── services/         # Business logic (future)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/       # UI components
│   │   ├── api/              # API client
│   │   ├── App.tsx           # Main application
│   │   └── index.css         # Terminal theme styles
│   └── package.json
└── README.md
```

## Features

- **Predictions View**: Display model predictions with edge calculations
- **Models View**: Manage and monitor ML models
- **Data View**: Upload and manage datasets

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Backend**: Python, FastAPI, scikit-learn, XGBoost, pandas
