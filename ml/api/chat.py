"""Chat endpoints: the Rakshak chatbot (RAG + Gemini) over HTTP.

POST /chat          text question  -> text reply
POST /chat/audio    audio question -> text reply (Gemini transcribes + answers)
POST /chat/speak    text           -> mp3 audio (read the reply aloud)

The bot is loaded once at startup. If it can't load (missing GEMINI_API_KEY,
missing packages), the price and storage-health endpoints still work and
the chat endpoints answer 503 with a clear message.
"""
import os
import re
import sys
import tempfile
from pathlib import Path
from typing import Literal, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette.background import BackgroundTask

try:
    from langdetect import DetectorFactory, detect
    DetectorFactory.seed = 0  # make detection deterministic
except ImportError:  # falls back to Marathi for Devanagari text
    detect = None

CHATBOT_DIR = Path(__file__).resolve().parent.parent / "chatbot"
ALLOWED_AUDIO = {".wav", ".mp3", ".m4a", ".ogg", ".flac"}
MAX_AUDIO_BYTES = 10 * 1024 * 1024

UNAVAILABLE = (
    "Rakshak is not available right now. Check GEMINI_API_KEY in "
    "ml/chatbot/.env and the server log."
)
BUSY = "Rakshak could not get an answer right now. Please try again in a moment."

router = APIRouter(prefix="/chat", tags=["chat"])
bot_state: dict = {"bot": None}


def _load_env_file() -> None:
    """Read ml/chatbot/.env explicitly and say what happened (never the key).
    utf-8-sig tolerates the invisible BOM that Windows Notepad can add, and
    override=True beats an empty GEMINI_API_KEY already set in the shell."""
    env_path = CHATBOT_DIR / ".env"
    if not env_path.exists():
        hint = ""
        if (CHATBOT_DIR / ".env.txt").exists():
            hint = " (found .env.txt instead; rename it to exactly .env)"
        print(f"Rakshak: no .env file at {env_path}{hint}")
        return
    from dotenv import load_dotenv
    try:
        load_dotenv(env_path, override=True, encoding="utf-8-sig")
    except UnicodeDecodeError:
        print(
            f"Rakshak: could not read {env_path} (wrong text encoding). Open it in "
            "VS Code, re-save it as UTF-8 (bottom-right corner > Save with Encoding)."
        )
        return
    key = os.environ.get("GEMINI_API_KEY", "")
    if key:
        print(f"Rakshak: GEMINI_API_KEY loaded from {env_path} (length {len(key)})")
    else:
        print(
            f"Rakshak: {env_path} exists but has no GEMINI_API_KEY line. "
            "It should be one line: GEMINI_API_KEY=your_key (no quotes, no spaces)."
        )


def init_bot() -> None:
    """Load the chatbot once. Never raises, so the rest of the API still starts."""
    # onion_qa_bot.py does `from rag_pipeline import ...`, so its folder must
    # be importable. It builds file paths from its own location, so no chdir.
    if str(CHATBOT_DIR) not in sys.path:
        sys.path.append(str(CHATBOT_DIR))
    _load_env_file()
    try:
        from onion_qa_bot import OnionQABot
        bot_state["bot"] = OnionQABot()
        print("Rakshak chatbot ready.")
    except Exception as exc:
        bot_state["bot"] = None
        print(f"Rakshak chatbot disabled: {type(exc).__name__}: {exc}")


def bot_ready() -> bool:
    return bot_state["bot"] is not None


def get_bot():
    bot = bot_state["bot"]
    if bot is None:
        raise HTTPException(status_code=503, detail=UNAVAILABLE)
    return bot


def detect_tts_lang(text: str) -> str:
    """'en' for Latin text; for Devanagari, pick Hindi or Marathi."""
    if not re.search(r"[\u0900-\u097F]", text):
        return "en"
    if detect is not None:
        try:
            code = detect(text)
            if code in ("hi", "mr"):
                return code
        except Exception:
            pass
    return "mr"


def _remove(path: str) -> None:
    try:
        os.remove(path)
    except OSError:
        pass


class ChatRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    message: str = Field(min_length=1, max_length=1000)


class ChatResponse(BaseModel):
    reply: str


class SpeakRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    text: str = Field(min_length=1, max_length=1500)
    lang: Optional[Literal["en", "hi", "mr"]] = None  # omit to auto-detect


@router.post("", response_model=ChatResponse)
def chat(req: ChatRequest):
    bot = get_bot()
    try:
        reply = bot.ask(req.message)
    except Exception as exc:
        print(f"/chat failed: {type(exc).__name__}: {exc}")
        raise HTTPException(status_code=502, detail=BUSY)
    return ChatResponse(reply=reply)


@router.post("/audio", response_model=ChatResponse)
def chat_audio(file: UploadFile = File(...)):
    bot = get_bot()
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_AUDIO:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported audio type. Send one of: {', '.join(sorted(ALLOWED_AUDIO))}.",
        )
    data = file.file.read(MAX_AUDIO_BYTES + 1)
    if not data:
        raise HTTPException(status_code=400, detail="The audio file is empty.")
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio file is too large (10 MB max).")

    fd, path = tempfile.mkstemp(suffix=ext)
    os.close(fd)
    try:
        with open(path, "wb") as f:
            f.write(data)
        reply = bot.ask_audio(path)
    except Exception as exc:
        print(f"/chat/audio failed: {type(exc).__name__}: {exc}")
        raise HTTPException(status_code=502, detail=BUSY)
    finally:
        _remove(path)
    return ChatResponse(reply=reply)


@router.post("/speak")
def chat_speak(req: SpeakRequest):
    bot = get_bot()
    lang = req.lang or detect_tts_lang(req.text)
    fd, path = tempfile.mkstemp(suffix=".mp3")
    os.close(fd)
    try:
        bot.speak(req.text, lang_hint=lang, output_path=path)
    except Exception as exc:
        _remove(path)
        print(f"/chat/speak failed: {type(exc).__name__}: {exc}")
        raise HTTPException(status_code=502, detail="Could not generate speech right now.")
    return FileResponse(
        path, media_type="audio/mpeg", background=BackgroundTask(_remove, path)
    )
