from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import predictions, models, data

app = FastAPI(
    title="Prediction Terminal API",
    description="API for building and running predictive models for sports",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


app.include_router(predictions.router, prefix="/api/predictions", tags=["predictions"])
app.include_router(models.router, prefix="/api/models", tags=["models"])
app.include_router(data.router, prefix="/api/data", tags=["data"])
