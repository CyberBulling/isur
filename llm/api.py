"""HTTP API for hybrid site assistant chat."""

import os
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    from site_agent import SiteAgent
except ModuleNotFoundError:
    from .site_agent import SiteAgent


def load_local_env() -> None:
    """Loads llm/.env into process environment when variables are absent."""
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        entry = line.strip()
        if not entry or entry.startswith("#") or "=" not in entry:
            continue
        key, value = entry.split("=", 1)
        key = key.strip()
        value = value.strip().strip("\"'")
        if key and key not in os.environ:
            os.environ[key] = value


load_local_env()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_site_agent: Optional[SiteAgent] = None


def get_site_agent() -> SiteAgent:
    """Lazy singleton initialization for hybrid assistant."""
    global _site_agent
    if _site_agent is None:
        key = os.getenv("GIGACHAT_AUTHORIZATION_KEY")
        _site_agent = SiteAgent(key)
    return _site_agent


class ChatRequest(BaseModel):
    """Chat request payload."""

    question: str = Field(..., min_length=1)
    top_n: int = Field(5, ge=1, le=30)
    session_id: Optional[str] = Field(default=None, max_length=128)
    comparison_state: list[dict[str, Any]] = Field(default_factory=list)


class ChatAction(BaseModel):
    """UI action description returned by assistant."""

    type: str
    label: str
    url: str


class ChatResponse(BaseModel):
    """Structured chat response."""

    answer: str
    session_id: str
    actions: list[ChatAction] = Field(default_factory=list)
    buildings_to_add: list[dict[str, Any]] = Field(default_factory=list)
    buildings_to_remove: list[dict[str, Any]] = Field(default_factory=list)
    clear_comparison: bool = False
    meta: dict[str, Any] = Field(default_factory=dict)


@app.get("/health")
def health() -> dict:
    """Health endpoint."""
    return {"status": "ok"}


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    """Returns hybrid assistant response."""
    session_id = req.session_id or "default"
    result = get_site_agent().process(
        req.question,
        session_id=session_id,
        top_n=req.top_n,
        comparison_state=req.comparison_state,
    )
    return ChatResponse(
        answer=result.get("answer", ""),
        session_id=session_id,
        actions=result.get("actions", []),
        buildings_to_add=result.get("buildings_to_add", []),
        buildings_to_remove=result.get("buildings_to_remove", []),
        clear_comparison=bool(result.get("clear_comparison", False)),
        meta=result.get("meta", {}),
    )
