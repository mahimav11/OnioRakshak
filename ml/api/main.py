"""OnioRakshak API: serves the price, risk and shelf-life models over HTTP.

Run from the ml/ folder:
    uvicorn api.main:app --reload --port 8000
Then open http://localhost:8000/docs to try the endpoints.
"""
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .chat import bot_ready, init_bot, router as chat_router

ML_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = ML_DIR / "models"
DATA_DIR = ML_DIR / "data"

# Exact category strings the models were trained on. The encoders ignore
# unknown values silently, so we only accept these (Literal types below).
Variety = Literal["Red", "Yellow", "White"]
StorageMode = Literal["Ventilated_ambient", "Warm_ambient", "DOGR_like"]

# Same feature list as notebook 02_model_training.ipynb
HEALTH_NUMERIC = [
    "initial_quality_score", "curing_score", "temperature_C",
    "relative_humidity_pct", "mq135_gas_index", "avg_temperature_24h_C",
    "avg_humidity_24h_pct", "avg_mq135_24h", "hours_temp_above_27C_24h",
    "hours_RH_above_65pct_24h", "storage_day",
]
HEALTH_CATEGORICAL = ["variety", "storage_mode"]

PRICE_NOTE = (
    "Prices come from a synthetic, research-anchored dataset. "
    "Treat this as a demo estimate, not a real market forecast."
)

state: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    state["price_model"] = joblib.load(MODEL_DIR / "price_predictor.joblib")
    state["risk_model"] = joblib.load(MODEL_DIR / "risk_classifier.joblib")
    state["shelf_model"] = joblib.load(MODEL_DIR / "shelf_life_regressor.joblib")

    price_df = pd.read_csv(
        DATA_DIR / "maharashtra_onion_price_dataset.csv", parse_dates=["date"]
    ).sort_values(["market", "variety", "date"]).reset_index(drop=True)
    state["price_df"] = price_df

    health_df = pd.read_csv(DATA_DIR / "onion_shelf_life_dataset.csv")
    # Real min/max seen in training data, used to warn about out-of-range inputs
    state["health_ranges"] = {
        c: (float(health_df[c].min()), float(health_df[c].max()))
        for c in HEALTH_NUMERIC
    }
    init_bot()  # chatbot is optional: the API still starts if it can't load
    yield
    state.clear()


app = FastAPI(title="OnioRakshak API", version="0.2.0", lifespan=lifespan)

app.include_router(chat_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- helpers ----------

def forecast_forward(pipeline, history_df, market, variety, days_ahead):
    """Roll the price model forward day by day, feeding each prediction back
    in as the next lag. Ported from notebook 03_price_model_training.ipynb."""
    subset = history_df[
        (history_df["market"] == market) & (history_df["variety"] == variety)
    ].sort_values("date")

    last_row = subset.iloc[-1]
    price_history = subset["modal_price"].tolist()
    forecasts = []
    current_date = last_row["date"]

    for _ in range(days_ahead):
        current_date = current_date + pd.Timedelta(days=1)
        feat = pd.DataFrame([{
            "month": current_date.month,
            "day_of_year": current_date.dayofyear,
            "price_lag_1": price_history[-1],
            "price_lag_7": price_history[-7] if len(price_history) >= 7 else price_history[0],
            "price_roll_mean_7": np.mean(price_history[-7:]),
            "price_roll_mean_30": np.mean(price_history[-30:]),
            "arrivals_lag_1": last_row["arrivals_quintal"],
            "market": market,
            "variety": variety,
        }])
        next_price = float(pipeline.predict(feat)[0])
        forecasts.append({"date": current_date.strftime("%Y-%m-%d"),
                          "price": round(next_price, 2)})
        price_history.append(next_price)
    return forecasts


# ---------- schemas ----------

class PriceRequest(BaseModel):
    market: str = Field(examples=["Lasalgaon APMC"])
    variety: str = Field(examples=["Red"])
    days_ahead: int = Field(default=14, ge=1, le=30)


class PricePoint(BaseModel):
    date: str
    price: float


class PriceResponse(BaseModel):
    market: str
    variety: str
    last_data_date: str
    last_price: float
    history: list[PricePoint]
    forecast: list[PricePoint]
    change_pct: float
    trend: Literal["rising", "falling", "steady"]
    note: str


class StorageHealthRequest(BaseModel):
    initial_quality_score: float = Field(ge=0, le=1)
    curing_score: float = Field(ge=0, le=1)
    temperature_C: float = Field(ge=-10, le=60)
    relative_humidity_pct: float = Field(ge=0, le=100)
    mq135_gas_index: float = Field(ge=0)
    avg_temperature_24h_C: float = Field(ge=-10, le=60)
    avg_humidity_24h_pct: float = Field(ge=0, le=100)
    avg_mq135_24h: float = Field(ge=0)
    hours_temp_above_27C_24h: float = Field(ge=0, le=24)
    hours_RH_above_65pct_24h: float = Field(ge=0, le=24)
    storage_day: int = Field(ge=0, le=365)
    variety: Variety
    storage_mode: StorageMode


class StorageHealthResponse(BaseModel):
    risk: str
    risk_probabilities: dict[str, float]
    shelf_life_days: float
    warnings: list[str]


# ---------- endpoints ----------

@app.get("/health")
def health():
    return {"status": "ok", "chatbot": bot_ready()}


@app.get("/meta")
def meta():
    """Allowed values and ranges, so the React forms never have to guess."""
    df = state["price_df"]
    combos = df.groupby("market")["variety"].unique()
    return {
        "price": {
            "markets": {m: sorted(v.tolist()) for m, v in combos.items()},
            "max_days_ahead": 30,
        },
        "storage_health": {
            "varieties": list(Variety.__args__),
            "storage_modes": list(StorageMode.__args__),
            "training_ranges": {
                k: {"min": lo, "max": hi}
                for k, (lo, hi) in state["health_ranges"].items()
            },
        },
    }


@app.post("/predict/price", response_model=PriceResponse)
def predict_price(req: PriceRequest):
    df = state["price_df"]
    subset = df[(df["market"] == req.market) & (df["variety"] == req.variety)]
    if subset.empty:
        valid = df.groupby("market")["variety"].unique()
        raise HTTPException(
            status_code=422,
            detail={
                "message": "No data for this market and variety.",
                "valid": {m: sorted(v.tolist()) for m, v in valid.items()},
            },
        )

    forecast = forecast_forward(
        state["price_model"], df, req.market, req.variety, req.days_ahead
    )
    last_price = float(subset.iloc[-1]["modal_price"])
    change_pct = (forecast[-1]["price"] - last_price) / last_price * 100
    trend = "rising" if change_pct > 3 else "falling" if change_pct < -3 else "steady"
    history = [
        {"date": d.strftime("%Y-%m-%d"), "price": round(float(p), 2)}
        for d, p in zip(subset["date"].tail(30), subset["modal_price"].tail(30))
    ]
    return PriceResponse(
        market=req.market,
        variety=req.variety,
        last_data_date=subset.iloc[-1]["date"].strftime("%Y-%m-%d"),
        last_price=round(last_price, 2),
        history=history,
        forecast=forecast,
        change_pct=round(change_pct, 2),
        trend=trend,
        note=PRICE_NOTE,
    )


@app.post("/predict/storage-health", response_model=StorageHealthResponse)
def predict_storage_health(req: StorageHealthRequest):
    row = req.model_dump()
    X = pd.DataFrame([row])[HEALTH_NUMERIC + HEALTH_CATEGORICAL]

    risk_model = state["risk_model"]
    risk = str(risk_model.predict(X)[0])
    probs = risk_model.predict_proba(X)[0]
    risk_probabilities = {
        str(c): round(float(p), 3) for c, p in zip(risk_model.classes_, probs)
    }
    shelf_days = float(state["shelf_model"].predict(X)[0])

    warnings = []
    for col, (lo, hi) in state["health_ranges"].items():
        if not (lo <= row[col] <= hi):
            warnings.append(
                f"{col} = {row[col]} is outside the range the model was trained on "
                f"({lo:.2f} to {hi:.2f}); the prediction may be unreliable."
            )

    return StorageHealthResponse(
        risk=risk,
        risk_probabilities=risk_probabilities,
        shelf_life_days=round(max(shelf_days, 0.0), 1),
        warnings=warnings,
    )
