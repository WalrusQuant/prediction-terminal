from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routers import predictions, models, data, templates

app = FastAPI(
    title="Prediction Terminal API",
    description="API for building and running predictive models for sports",
    version="0.1.0",
)

# CORS middleware - must be added before other middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch all exceptions and return proper JSON with CORS headers."""
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "detail": "Internal server error"},
    )


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


app.include_router(predictions.router, prefix="/api/predictions", tags=["predictions"])
app.include_router(models.router, prefix="/api/models", tags=["models"])
app.include_router(data.router, prefix="/api/data", tags=["data"])
app.include_router(templates.router, prefix="/api/templates", tags=["templates"])
