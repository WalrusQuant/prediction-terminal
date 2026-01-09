"""Prediction templates router for saving and loading input templates."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional
from datetime import datetime
import json
import os

router = APIRouter()

# Directory for persisting templates
TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "templates")
os.makedirs(TEMPLATES_DIR, exist_ok=True)

TEMPLATES_FILE = os.path.join(TEMPLATES_DIR, "templates.json")

# In-memory template storage
templates: Dict[str, dict] = {}


class CreateTemplateRequest(BaseModel):
    name: str
    model_id: str
    input_values: Dict[str, float]
    description: Optional[str] = None


class UpdateTemplateRequest(BaseModel):
    name: Optional[str] = None
    input_values: Optional[Dict[str, float]] = None
    description: Optional[str] = None


def _save_templates():
    """Save templates to disk."""
    with open(TEMPLATES_FILE, "w") as f:
        json.dump(templates, f, indent=2)


def _load_templates():
    """Load templates from disk."""
    global templates
    if os.path.exists(TEMPLATES_FILE):
        try:
            with open(TEMPLATES_FILE, "r") as f:
                templates.update(json.load(f))
        except Exception:
            pass


# Load on module import
_load_templates()


@router.get("/")
async def list_templates(model_id: Optional[str] = None):
    """List all templates, optionally filtered by model_id."""
    _load_templates()
    if model_id:
        filtered = {k: v for k, v in templates.items() if v.get("model_id") == model_id}
        return {"templates": list(filtered.values())}
    return {"templates": list(templates.values())}


@router.get("/{template_id}")
async def get_template(template_id: str):
    """Get a specific template."""
    _load_templates()
    if template_id not in templates:
        raise HTTPException(status_code=404, detail="Template not found")
    return templates[template_id]


@router.post("/")
async def create_template(request: CreateTemplateRequest):
    """Create a new prediction template."""
    import time

    template_id = f"template_{int(time.time() * 1000)}"

    template = {
        "id": template_id,
        "name": request.name,
        "model_id": request.model_id,
        "input_values": request.input_values,
        "description": request.description,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    }

    templates[template_id] = template
    _save_templates()

    return {"message": "Template created", "template": template}


@router.put("/{template_id}")
async def update_template(template_id: str, request: UpdateTemplateRequest):
    """Update an existing template."""
    _load_templates()
    if template_id not in templates:
        raise HTTPException(status_code=404, detail="Template not found")

    template = templates[template_id]

    if request.name is not None:
        template["name"] = request.name
    if request.input_values is not None:
        template["input_values"] = request.input_values
    if request.description is not None:
        template["description"] = request.description

    template["updated_at"] = datetime.now().isoformat()

    templates[template_id] = template
    _save_templates()

    return {"message": "Template updated", "template": template}


@router.delete("/{template_id}")
async def delete_template(template_id: str):
    """Delete a template."""
    _load_templates()
    if template_id not in templates:
        raise HTTPException(status_code=404, detail="Template not found")

    del templates[template_id]
    _save_templates()

    return {"message": "Template deleted", "template_id": template_id}
