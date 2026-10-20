import os
import json
import logging
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("media-curator-ai")

GCP_PROJECT = os.environ.get("GCP_PROJECT", "project-51459e90-fbb3-471f-9f9")
GCP_REGION = os.environ.get("GCP_REGION", "us-central1")
TMDB_API_KEY = os.environ.get("TMDB_API_KEY", "15d2ea6d0dc1d476efbca3eba2b9bbfb")
MODEL_NAME = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")

app = FastAPI(
    title="Amin's Media Tracker - Vertex AI Curator API",
    version="2.0.0",
    description="Real AI Cinema Curator backend powered by Google Cloud Vertex AI Gemini models."
)

# Enable CORS for Web, iOS & Android Flutter clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lazy Vertex AI model reference
vertex_model = None
vertex_initialized = False

def get_vertex_model():
    global vertex_model, vertex_initialized
    if vertex_model is not None:
        return vertex_model
    try:
        import vertexai
        from vertexai.generative_models import GenerativeModel
        vertexai.init(project=GCP_PROJECT, location=GCP_REGION)
        vertex_model = GenerativeModel(MODEL_NAME)
        vertex_initialized = True
        logger.info(f"Initialized Vertex AI Gemini ({MODEL_NAME}) in {GCP_REGION}")
        return vertex_model
    except Exception as e:
        logger.warning(f"Vertex AI initialization deferred/failed: {e}")
        return None

class MediaItemContext(BaseModel):
    title: str
    year: Optional[str] = None
    director: Optional[str] = None
    type: Optional[str] = "movie"
    rating: Optional[float] = None
    watched: Optional[bool] = False

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Dict[str, str]]] = []
    watchlist: Optional[List[MediaItemContext]] = []

class RecommendationItem(BaseModel):
    id: Optional[str] = None
    title: str
    year: Optional[str] = None
    director: Optional[str] = None
    type: Optional[str] = "movie"
    rating: Optional[float] = None
    overview: Optional[str] = None
    poster: Optional[str] = None

class ChatResponse(BaseModel):
    text: str
    recommendations: List[RecommendationItem] = []
    model: str
    source: str

SYSTEM_INSTRUCTION = """
You are Amin's elite AI Cinema Curator & Prestige Film Historian.
You possess encyclopedic knowledge of world cinema, auteur directors (such as Denis Villeneuve, Christopher Nolan, Wong Kar-wai, Hayao Miyazaki, David Lynch, Quentin Tarantino), and prestige television.

Your goals:
1. Provide thoughtful, cinephile-grade advice tailored to the user's taste and watchlist backlog.
2. When the user asks what to watch, analyze their watched vs. unwatched titles.
3. Recommend specific films or shows with release years, directors, and brief compelling reasons why they should watch them.
4. Format your response clearly. At the very end of your response, ALWAYS include a JSON block with recommended titles so the app can render 1-click 'Add to Watchlist' buttons:

```json
[
  {
    "title": "Title Name",
    "year": "YYYY",
    "director": "Director Name",
    "type": "movie or tv",
    "overview": "Short 1-2 sentence hook"
  }
]
```
Ensure the JSON block is syntactically valid JSON.
"""

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "vertex_ai_initialized": vertex_initialized,
        "project": GCP_PROJECT,
        "region": GCP_REGION,
        "model": MODEL_NAME
    }

async def fetch_tmdb_poster(title: str, year: Optional[str] = None, media_type: str = "movie") -> Optional[str]:
    """Helper to fetch verified TMDB poster path"""
    try:
        url = f"https://api.themoviedb.org/3/search/{'tv' if media_type == 'tv' else 'movie'}"
        params = {"api_key": TMDB_API_KEY, "query": title}
        if year and year.isdigit():
            params["year" if media_type == "movie" else "first_air_date_year"] = year
        
        async with httpx.AsyncClient(timeout=4.0) as client:
            res = await client.get(url, params=params)
            if res.status_code == 200:
                data = res.json()
                results = data.get("results", [])
                if results and results[0].get("poster_path"):
                    return f"https://image.tmdb.org/t/p/w500{results[0]['poster_path']}"
    except Exception as e:
        logger.warning(f"TMDB poster fetch failed for '{title}': {e}")
    return None

@app.post("/api/chat", response_model=ChatResponse)
async def chat_with_curator(req: ChatRequest):
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # Build context summary from user's active watchlist
    total_titles = len(req.watchlist)
    watched_titles = [item.title for item in req.watchlist if item.watched]
    unwatched_titles = [item.title for item in req.watchlist if not item.watched]
    
    directors_in_library = list(set(
        item.director for item in req.watchlist if item.director and item.director != "Unknown"
    ))[:20]

    context_prompt = f"""
Current User Watchlist Context:
- Total Titles in Library: {total_titles}
- Watched Titles ({len(watched_titles)}): {', '.join(watched_titles[:15]) if watched_titles else 'None yet'}
- Unwatched Backlog ({len(unwatched_titles)}): {', '.join(unwatched_titles[:20]) if unwatched_titles else 'Empty'}
- Sample Directors in Library: {', '.join(directors_in_library) if directors_in_library else 'Various'}

User Question / Request:
{req.message}
"""

    response_text = ""
    used_model = MODEL_NAME
    source = "vertex-ai"
    recommendations: List[RecommendationItem] = []

    model = get_vertex_model()
    if model:
        try:
            from vertexai.generative_models import GenerationConfig
            full_prompt = f"{SYSTEM_INSTRUCTION}\n\n{context_prompt}"
            generation_config = GenerationConfig(
                temperature=0.7,
                max_output_tokens=1024,
                top_p=0.95,
            )
            resp = model.generate_content(full_prompt, generation_config=generation_config)
            response_text = resp.text
        except Exception as e:
            logger.error(f"Vertex AI generation failed: {e}")
            dirs = ', '.join(directors_in_library[:2]) if directors_in_library else 'Denis Villeneuve and Christopher Nolan'
            response_text = (
                f"As your Cinema Curator, based on your active watchlist of {total_titles} titles ({len(unwatched_titles)} unwatched), "
                f"I recommend exploring the catalog of {dirs}. Here are curated cinematic selections tailored to your taste:"
            )
            top_picks = [t for t in req.watchlist if not t.watched][:3]
            for item in top_picks:
                recommendations.append(RecommendationItem(
                    id=f"rec_{abs(hash(item.title))}",
                    title=item.title,
                    year=item.year or "",
                    director=item.director or "",
                    type=item.type or "movie",
                    overview=f"Featured watchlist highlight directed by {item.director or 'master filmmaker'}.",
                    poster=None
                ))
            source = "local-curator-fallback"
    else:
        # Fallback local intelligence if Vertex is not initialized
        dirs = ', '.join(directors_in_library[:2]) if directors_in_library else 'master filmmakers'
        response_text = f"Hello! As your Cinema Curator, based on your backlog of {len(unwatched_titles)} unwatched titles, I recommend exploring films by {dirs}."
        source = "local-heuristic"

    # Extract JSON recommendations if embedded
    try:
        if "```json" in response_text:
            json_recs: List[RecommendationItem] = []
            json_part = response_text.split("```json")[1].split("```")[0].strip()
            parsed = json.loads(json_part)
            if isinstance(parsed, list):
                for item in parsed:
                    title = item.get("title", "")
                    year = str(item.get("year", ""))
                    m_type = item.get("type", "movie")
                    poster = await fetch_tmdb_poster(title, year, m_type)
                    
                    json_recs.append(RecommendationItem(
                        id=f"rec_{abs(hash(title))}",
                        title=title,
                        year=year,
                        director=item.get("director", ""),
                        type=m_type,
                        overview=item.get("overview", ""),
                        poster=poster
                    ))
                if json_recs:
                    recommendations = json_recs
            # Clean JSON codeblock out of display text
            response_text = response_text.split("```json")[0].strip()
    except Exception as e:
        logger.warning(f"Failed to parse recommendations JSON from model output: {e}")

    return ChatResponse(
        text=response_text,
        recommendations=recommendations,
        model=used_model,
        source=source
    )
