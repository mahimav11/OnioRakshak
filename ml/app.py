"""
OnioRakshak — Farmer Dashboard
================================
Single-page Streamlit app bringing together all three ML features plus
the Rakshak chatbot:

  1. Price Forecast     — next-N-day onion price forecast per market/variety
  2. Storage Health      — risk status + remaining shelf-life from sensor readings
  3. Rakshak Chat         — RAG-grounded, multilingual, voice-enabled Q&A

Run from the `ml/` folder:
    streamlit run app.py

Requires:
  - models/price_predictor.joblib, risk_classifier.joblib, shelf_life_regressor.joblib
  - data/maharashtra_onion_price_dataset.csv
  - chatbot/.env with GEMINI_API_KEY=your_key_here
  - pip install -r requirements.txt  (see accompanying requirements.txt)
"""

import html
import os
import re
import sys
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st
from langdetect import DetectorFactory, LangDetectException, detect

# langdetect's default behavior is non-deterministic across runs unless
# seeded (it uses a probabilistic n-gram model internally) — fix the seed
# so the same text always gets the same detected language.
DetectorFactory.seed = 0

# ---------------------------------------------------------------------------
# Paths — resolved as absolutes up front, since the chatbot module needs its
# own working directory changed (its RAG pipeline reads files relative to
# itself), and we don't want that to break the model/data paths below.
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
DATA_DIR = BASE_DIR / "data"
CHATBOT_DIR = BASE_DIR / "chatbot"

PRICE_MODEL_PATH = MODELS_DIR / "price_predictor.joblib"
RISK_MODEL_PATH = MODELS_DIR / "risk_classifier.joblib"
SHELF_LIFE_MODEL_PATH = MODELS_DIR / "shelf_life_regressor.joblib"
PRICE_DATA_PATH = DATA_DIR / "maharashtra_onion_price_dataset.csv"

st.set_page_config(
    page_title="OnioRakshak — Rakshak Dashboard",
    page_icon="🧅",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ---------------------------------------------------------------------------
# Category values — pulled directly from the training data, do not edit
# without re-checking against the real dataset (silently wrong predictions
# otherwise, since the encoders ignore unrecognized categories).
# ---------------------------------------------------------------------------
SL_VARIETIES = ["Red", "Yellow", "White"]
STORAGE_MODES = {
    "Open-air ventilated shed": "Ventilated_ambient",
    "Warm closed room": "Warm_ambient",
    "Cold-like store (DOGR-style)": "DOGR_like",
}
PRICE_MARKETS = [
    "Lasalgaon APMC", "Pimpalgaon APMC", "Pune APMC",
    "Solapur APMC", "Ahilyanagar APMC",
]
PRICE_VARIETIES = ["Red", "Local", "Nashik Red"]

RISK_STYLE = {
    "Critical": {"color": "#A94442", "icon": "🔴", "label": "Critical — act now"},
    "Warning": {"color": "#C97A1A", "icon": "🟠", "label": "Warning — watch closely"},
    "Safe": {"color": "#4A7C59", "icon": "🟢", "label": "Safe"},
}

# ---------------------------------------------------------------------------
# Cached loaders
# ---------------------------------------------------------------------------
@st.cache_resource(show_spinner=False)
def load_models():
    price_model = joblib.load(PRICE_MODEL_PATH)
    risk_model = joblib.load(RISK_MODEL_PATH)
    shelf_life_model = joblib.load(SHELF_LIFE_MODEL_PATH)
    return price_model, risk_model, shelf_life_model


@st.cache_data(show_spinner=False)
def load_price_history():
    df = pd.read_csv(PRICE_DATA_PATH, parse_dates=["date"])
    return df.sort_values(["market", "variety", "date"]).reset_index(drop=True)


@st.cache_resource(show_spinner=False)
def load_rakshak_bot():
    """Loads the Rakshak (RAG) chatbot. Changes the working directory to
    chatbot/ first, since its RAG pipeline reads onion_knowledge_base.json
    and writes its FAISS index using paths relative to itself."""
    original_cwd = os.getcwd()
    os.chdir(CHATBOT_DIR)
    sys.path.insert(0, str(CHATBOT_DIR))
    try:
        from onion_qa_bot import OnionQABot
        bot = OnionQABot()
        return bot, None
    except Exception as e:
        return None, str(e)
    finally:
        os.chdir(original_cwd)


def forecast_forward(pipeline, history_df, market, variety, days_ahead=14):
    """Rolls the price model forward day-by-day, feeding each day's
    prediction back in as the next day's lag feature — same logic as the
    training notebook's forecast_forward()."""
    subset = history_df[
        (history_df["market"] == market) & (history_df["variety"] == variety)
    ].sort_values("date").copy()

    if subset.empty:
        return pd.DataFrame(columns=["date", "forecast_price"])

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
        next_price = pipeline.predict(feat)[0]
        forecasts.append({"date": current_date, "forecast_price": next_price})
        price_history.append(next_price)

    return pd.DataFrame(forecasts)


def guess_tts_lang(text: str) -> str:
    """Detects Hindi vs Marathi vs English so the 'Listen' button uses the
    right gTTS voice. langdetect can tell Hindi and Marathi apart (unlike
    a plain Devanagari-script check, which can't — they share a script),
    though it isn't perfect on short text. Falls back to a Devanagari
    check (defaulting to Hindi) if detection fails or returns something
    gTTS doesn't support; OnionQABot.speak() has its own fallback chain
    on top of this as a final safety net."""
    try:
        detected = detect(text)
    except LangDetectException:
        detected = None

    if detected in ("hi", "mr", "en"):
        return detected

    # langdetect doesn't know Marathi as well as Hindi on short strings and
    # can misfire — fall back to a script check rather than trust an
    # unexpected code (e.g. it occasionally returns 'ne' for Devanagari text).
    if re.search(r"[\u0900-\u097F]", text):
        return "hi"
    return "en"


# ---------------------------------------------------------------------------
# Styling — brand tokens: copper/onion-skin accent, crop green for "safe",
# warm wheat background. Fraunces for display type, Inter for body/UI,
# Noto Sans Devanagari layered in so Hindi/Marathi chat replies render
# correctly instead of showing tofu boxes.
# ---------------------------------------------------------------------------
CUSTOM_CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;600&display=swap');

:root {
    --copper: #B5651D;
    --copper-deep: #8B4513;
    --crop-green: #4A7C59;
    --warn-amber: #C97A1A;
    --alert-red: #A94442;
    --wheat-bg: #F7EFDD;
    --card-bg: #FFFCF5;
    --ink: #2B211A;
    --ink-soft: #6B5D4F;
    --border: #E4D8BF;
}

html, body, [class*="css"]  {
    font-family: 'Inter', 'Noto Sans Devanagari', sans-serif;
    color: var(--ink);
}

.stApp {
    background: var(--wheat-bg);
}

h1, h2, h3 { font-family: 'Fraunces', serif; color: var(--ink); }

/* ---------- Hero ---------- */
.rakshak-hero {
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 22px 8px 6px 8px;
    animation: heroIn 0.6s ease-out;
}
.rakshak-hero .emoji { font-size: 44px; line-height: 1; }
.rakshak-hero h1 {
    font-size: 2.1rem;
    margin: 0;
    font-weight: 600;
}
.rakshak-hero p {
    margin: 2px 0 0 0;
    color: var(--ink-soft);
    font-size: 1.05rem;
}
@keyframes heroIn {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
}

/* ---------- Tabs, restyled as a segmented control ---------- */
.stTabs [data-baseweb="tab-list"] {
    gap: 6px;
    background: var(--card-bg);
    padding: 6px;
    border-radius: 14px;
    border: 1px solid var(--border);
}
.stTabs [data-baseweb="tab"] {
    height: 46px;
    border-radius: 10px;
    padding: 0 18px;
    font-weight: 600;
    font-size: 1.02rem;
    color: var(--ink-soft);
}
.stTabs [aria-selected="true"] {
    background: var(--copper) !important;
    color: white !important;
}

/* ---------- Section card ---------- */
.rk-section {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 22px 24px;
    margin-top: 14px;
}

/* ---------- Buttons ---------- */
.stButton > button {
    background: var(--copper);
    color: white;
    border: none;
    border-radius: 10px;
    padding: 10px 20px;
    font-weight: 600;
    font-size: 1rem;
    transition: background 0.15s ease;
}
.stButton > button:hover { background: var(--copper-deep); color: white; }

/* ---------- Result badges ---------- */
.rk-badge {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 14px 20px;
    border-radius: 12px;
    font-size: 1.25rem;
    font-weight: 700;
    color: white;
}
.rk-metric-label { color: var(--ink-soft); font-size: 0.95rem; margin-bottom: 2px; }
.rk-metric-value { font-size: 1.6rem; font-weight: 700; font-family: 'Fraunces', serif; }

/* ---------- Chat ---------- */
.rk-chat-wrap { display: flex; flex-direction: column; gap: 14px; padding: 4px 2px 8px 2px; }
.rk-msg {
    display: flex;
    gap: 10px;
    max-width: 78%;
    animation: msgIn 0.28s ease-out;
}
.rk-msg.user { align-self: flex-end; flex-direction: row-reverse; }
.rk-msg.bot { align-self: flex-start; }
.rk-avatar {
    flex-shrink: 0;
    width: 36px; height: 36px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px;
}
.rk-avatar.user { background: var(--crop-green); }
.rk-avatar.bot { background: var(--copper); }
.rk-bubble {
    padding: 12px 16px;
    border-radius: 16px;
    font-size: 1.02rem;
    line-height: 1.5;
    font-family: 'Inter', 'Noto Sans Devanagari', sans-serif;
    white-space: pre-wrap;
}
.rk-msg.user .rk-bubble { background: var(--crop-green); color: white; border-bottom-right-radius: 4px; }
.rk-msg.bot .rk-bubble { background: var(--card-bg); border: 1px solid var(--border); border-bottom-left-radius: 4px; }
@keyframes msgIn {
    from { opacity: 0; transform: translateY(6px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}

.rk-typing { display: inline-flex; gap: 4px; padding: 4px 2px; }
.rk-typing span {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--ink-soft);
    animation: typingBounce 1.1s infinite ease-in-out;
}
.rk-typing span:nth-child(2) { animation-delay: 0.15s; }
.rk-typing span:nth-child(3) { animation-delay: 0.3s; }
@keyframes typingBounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
    30% { transform: translateY(-5px); opacity: 1; }
}

.rk-footer-note { color: var(--ink-soft); font-size: 0.85rem; margin-top: 18px; text-align: center; }
</style>
"""

st.markdown(CUSTOM_CSS, unsafe_allow_html=True)

st.markdown(
    """
    <div class="rakshak-hero">
        <div class="emoji">🧅🛡️</div>
        <div>
            <h1>OnioRakshak</h1>
            <p>Price outlook, storage health, and Rakshak — your onion assistant — in one place.</p>
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

tab_price, tab_health, tab_chat = st.tabs(["💰 Price Forecast", "🌡️ Storage Health", "🤖 Rakshak Chat"])

# ===========================================================================
# TAB 1 — Price Forecast
# ===========================================================================
with tab_price:
    st.markdown('<div class="rk-section">', unsafe_allow_html=True)
    st.markdown("### Where are onion prices headed?")
    st.caption("Pick your market and variety — Rakshak forecasts the next few days using recent price trends.")

    col1, col2, col3 = st.columns(3)
    with col1:
        sel_market = st.selectbox("Market", PRICE_MARKETS)
    with col2:
        sel_price_variety = st.selectbox("Variety", PRICE_VARIETIES)
    with col3:
        days_ahead = st.slider("Days to forecast", min_value=3, max_value=30, value=14)

    if st.button("📈 Forecast prices", key="price_forecast_btn"):
        with st.spinner("Rakshak is crunching recent price trends..."):
            price_model, _, _ = load_models()
            history_df = load_price_history()
            forecast_df = forecast_forward(price_model, history_df, sel_market, sel_price_variety, days_ahead)

        if forecast_df.empty:
            st.error(f"No historical data found for {sel_price_variety} at {sel_market}. Try a different combination.")
        else:
            last_actual_row = history_df[
                (history_df["market"] == sel_market) & (history_df["variety"] == sel_price_variety)
            ].sort_values("date").iloc[-1]
            last_actual_price = last_actual_row["modal_price"]
            final_forecast_price = forecast_df["forecast_price"].iloc[-1]
            pct_change = (final_forecast_price - last_actual_price) / last_actual_price * 100

            m1, m2, m3 = st.columns(3)
            with m1:
                st.markdown('<div class="rk-metric-label">Current price</div>', unsafe_allow_html=True)
                st.markdown(f'<div class="rk-metric-value">₹{last_actual_price:,.0f}</div>', unsafe_allow_html=True)
            with m2:
                st.markdown(f'<div class="rk-metric-label">Forecast in {days_ahead} days</div>', unsafe_allow_html=True)
                st.markdown(f'<div class="rk-metric-value">₹{final_forecast_price:,.0f}</div>', unsafe_allow_html=True)
            with m3:
                direction = "📈 up" if pct_change >= 0 else "📉 down"
                color = "var(--alert-red)" if pct_change >= 8 else "var(--warn-amber)" if pct_change >= 0 else "var(--crop-green)"
                st.markdown('<div class="rk-metric-label">Expected change</div>', unsafe_allow_html=True)
                st.markdown(
                    f'<div class="rk-metric-value" style="color:{color}">{direction} {abs(pct_change):.1f}%</div>',
                    unsafe_allow_html=True,
                )

            fig = go.Figure()
            history_tail = history_df[
                (history_df["market"] == sel_market) & (history_df["variety"] == sel_price_variety)
            ].sort_values("date").tail(30)
            fig.add_trace(go.Scatter(
                x=history_tail["date"], y=history_tail["modal_price"],
                mode="lines", name="Recent actual price",
                line=dict(color="#8B4513", width=2.5),
            ))
            fig.add_trace(go.Scatter(
                x=forecast_df["date"], y=forecast_df["forecast_price"],
                mode="lines+markers", name="Forecast",
                line=dict(color="#B5651D", width=2.5, dash="dot"),
                marker=dict(size=6),
            ))
            fig.update_layout(
                height=380,
                margin=dict(l=10, r=10, t=20, b=10),
                plot_bgcolor="#FFFCF5",
                paper_bgcolor="#FFFCF5",
                font=dict(family="Inter, sans-serif", color="#2B211A"),
                legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="left", x=0),
                yaxis_title="Price (₹ per quintal)",
            )
            st.plotly_chart(fig, use_container_width=True)
    st.markdown("</div>", unsafe_allow_html=True)

# ===========================================================================
# TAB 2 — Storage Health (risk + shelf-life together, same inputs)
# ===========================================================================
with tab_health:
    st.markdown('<div class="rk-section">', unsafe_allow_html=True)
    st.markdown("### How is your stored onion batch doing?")
    st.caption("Enter your batch's current readings — Rakshak checks both risk level and days of shelf-life left.")

    c1, c2, c3 = st.columns(3)
    with c1:
        sl_variety = st.selectbox("Onion variety", SL_VARIETIES)
    with c2:
        storage_mode_label = st.selectbox("Storage type", list(STORAGE_MODES.keys()))
        storage_mode = STORAGE_MODES[storage_mode_label]
    with c3:
        storage_day = st.number_input("Days in storage so far", min_value=0, max_value=180, value=5, step=1)

    c4, c5 = st.columns(2)
    with c4:
        initial_quality_score = st.slider("Quality at intake (0 = poor, 10 = excellent)", 0.0, 10.0, 7.0, 0.5)
    with c5:
        curing_score = st.slider("Curing quality (0 = uncured, 10 = well-cured)", 0.0, 10.0, 7.0, 0.5)

    st.markdown("**Current sensor readings**")
    c6, c7, c8 = st.columns(3)
    with c6:
        temperature_C = st.number_input("Temperature (°C)", min_value=0.0, max_value=50.0, value=27.0, step=0.5)
    with c7:
        relative_humidity_pct = st.number_input("Relative humidity (%)", min_value=0.0, max_value=100.0, value=65.0, step=1.0)
    with c8:
        mq135_gas_index = st.number_input("MQ135 gas index", min_value=0.0, max_value=1000.0, value=120.0, step=5.0)

    with st.expander("Advanced — 24-hour averages (optional)"):
        st.caption("Leave as-is to approximate using your current readings above.")
        a1, a2, a3 = st.columns(3)
        with a1:
            avg_temperature_24h_C = st.number_input("Avg temperature, last 24h (°C)", value=temperature_C)
        with a2:
            avg_humidity_24h_pct = st.number_input("Avg humidity, last 24h (%)", value=relative_humidity_pct)
        with a3:
            avg_mq135_24h = st.number_input("Avg gas index, last 24h", value=mq135_gas_index)
        a4, a5 = st.columns(2)
        with a4:
            hours_temp_above_27C_24h = st.number_input("Hours above 27°C in last 24h", min_value=0.0, max_value=24.0, value=0.0)
        with a5:
            hours_RH_above_65pct_24h = st.number_input("Hours above 65% humidity in last 24h", min_value=0.0, max_value=24.0, value=0.0)

    if st.button("🔍 Check storage health", key="health_check_btn"):
        _, risk_model, shelf_life_model = load_models()
        features = pd.DataFrame([{
            "initial_quality_score": initial_quality_score,
            "curing_score": curing_score,
            "temperature_C": temperature_C,
            "relative_humidity_pct": relative_humidity_pct,
            "mq135_gas_index": mq135_gas_index,
            "avg_temperature_24h_C": avg_temperature_24h_C,
            "avg_humidity_24h_pct": avg_humidity_24h_pct,
            "avg_mq135_24h": avg_mq135_24h,
            "hours_temp_above_27C_24h": hours_temp_above_27C_24h,
            "hours_RH_above_65pct_24h": hours_RH_above_65pct_24h,
            "storage_day": storage_day,
            "variety": sl_variety,
            "storage_mode": storage_mode,
        }])

        risk_status = risk_model.predict(features)[0]
        shelf_life_days = shelf_life_model.predict(features)[0]
        style = RISK_STYLE.get(risk_status, RISK_STYLE["Warning"])

        r1, r2 = st.columns([1, 1])
        with r1:
            st.markdown(
                f'<div class="rk-badge" style="background:{style["color"]}">{style["icon"]} {style["label"]}</div>',
                unsafe_allow_html=True,
            )
        with r2:
            st.markdown('<div class="rk-metric-label">Estimated shelf-life remaining</div>', unsafe_allow_html=True)
            st.markdown(f'<div class="rk-metric-value">{shelf_life_days:.0f} days</div>', unsafe_allow_html=True)

        max_days = 40  # roughly the upper end of the training data's typical range
        progress_pct = max(0.0, min(1.0, shelf_life_days / max_days))
        st.progress(progress_pct)

        if risk_status == "Critical":
            st.error("This batch needs attention soon — consider moving it to market or improving ventilation/cooling.")
        elif risk_status == "Warning":
            st.warning("Keep an eye on this batch — conditions are drifting toward risky territory.")
        else:
            st.success("This batch is in good shape for now.")
    st.markdown("</div>", unsafe_allow_html=True)

# ===========================================================================
# TAB 3 — Rakshak Chat
# ===========================================================================
with tab_chat:
    st.markdown('<div class="rk-section">', unsafe_allow_html=True)

    header_col, clear_col = st.columns([5, 1])
    with header_col:
        st.markdown("### 🤖 Ask Rakshak")
        st.caption("Ask about storage, diseases, prices, or anything onion-related — in English, Hindi, or Marathi.")
    with clear_col:
        if st.button("🗑️ New chat"):
            st.session_state.rk_messages = []
            st.session_state.rk_audio_cache = {}
            st.rerun()

    if "rk_messages" not in st.session_state:
        st.session_state.rk_messages = []
    if "rk_audio_cache" not in st.session_state:
        st.session_state.rk_audio_cache = {}

    bot, bot_error = load_rakshak_bot()

    if bot_error:
        st.error(
            "Rakshak couldn't start. Make sure `chatbot/.env` has a valid "
            f"`GEMINI_API_KEY`.\n\nDetails: {bot_error}"
        )
    else:
        chat_container = st.container()

        def render_messages():
            html_parts = ['<div class="rk-chat-wrap">']
            for msg in st.session_state.rk_messages:
                role = "user" if msg["role"] == "user" else "bot"
                avatar = "🧑‍🌾" if role == "user" else "🧅"
                safe_text = html.escape(msg["content"])
                html_parts.append(
                    f'<div class="rk-msg {role}">'
                    f'<div class="rk-avatar {role}">{avatar}</div>'
                    f'<div class="rk-bubble">{safe_text}</div>'
                    f'</div>'
                )
            html_parts.append("</div>")
            return "".join(html_parts)

        with chat_container:
            st.markdown(render_messages(), unsafe_allow_html=True)

        # --- Voice input ---
        # Prefer live mic recording (st.audio_input, Streamlit >= 1.38). On
        # older Streamlit versions where it doesn't exist, fall back to a
        # file uploader so voice input still works either way.
        with st.expander("🎙️ Or ask by voice", expanded=False):
            recorded_audio = None
            uploaded_audio = None
            audio_suffix = ".wav"

            if hasattr(st, "audio_input"):
                recorded_audio = st.audio_input("Record your question", key="rk_audio_record")
            else:
                st.caption(
                    "Live recording needs Streamlit 1.38+. Run "
                    "`pip install -U streamlit` to enable it — using file "
                    "upload for now."
                )
                uploaded_audio = st.file_uploader(
                    "Upload a short voice clip (wav, mp3, m4a, ogg)",
                    type=["wav", "mp3", "m4a", "ogg"],
                    key="rk_audio_upload",
                )
                if uploaded_audio is not None:
                    audio_suffix = Path(uploaded_audio.name).suffix or ".wav"

            audio_data = recorded_audio or uploaded_audio

            if audio_data is not None and st.button("Send voice question", key="rk_send_voice"):
                temp_audio_path = BASE_DIR / f"_tmp_voice_input{audio_suffix}"
                with open(temp_audio_path, "wb") as f:
                    f.write(audio_data.getbuffer())
                st.session_state.rk_messages.append({"role": "user", "content": "🎙️ (voice question)"})
                with st.spinner("Rakshak is listening..."):
                    try:
                        reply = bot.ask_audio(str(temp_audio_path))
                    except Exception as e:
                        reply = f"Sorry, I couldn't process that audio: {e}"
                    finally:
                        temp_audio_path.unlink(missing_ok=True)
                st.session_state.rk_messages.append({"role": "bot", "content": reply})
                st.rerun()

        # --- Text input ---
        user_input = st.chat_input("Type your onion question here...")
        if user_input:
            st.session_state.rk_messages.append({"role": "user", "content": user_input})

            with chat_container:
                typing_placeholder = st.empty()
                typing_placeholder.markdown(
                    '<div class="rk-chat-wrap"><div class="rk-msg bot">'
                    '<div class="rk-avatar bot">🧅</div>'
                    '<div class="rk-bubble"><div class="rk-typing"><span></span><span></span><span></span></div></div>'
                    '</div></div>',
                    unsafe_allow_html=True,
                )
                try:
                    reply = bot.ask(user_input)
                except Exception as e:
                    reply = f"Sorry, I ran into an error reaching Rakshak's brain: {e}"
                typing_placeholder.empty()

            st.session_state.rk_messages.append({"role": "bot", "content": reply})
            st.rerun()

        # --- Listen buttons for the last bot reply ---
        if st.session_state.rk_messages and st.session_state.rk_messages[-1]["role"] == "bot":
            last_idx = len(st.session_state.rk_messages) - 1
            last_reply = st.session_state.rk_messages[-1]["content"]
            if st.button("🔊 Listen to Rakshak's last answer", key="rk_listen_btn"):
                if last_idx not in st.session_state.rk_audio_cache:
                    with st.spinner("Generating voice..."):
                        lang_hint = guess_tts_lang(last_reply)
                        audio_path = BASE_DIR / f"_tmp_voice_reply_{last_idx}.mp3"
                        try:
                            bot.speak(last_reply, lang_hint=lang_hint, output_path=str(audio_path))
                            st.session_state.rk_audio_cache[last_idx] = audio_path.read_bytes()
                            audio_path.unlink(missing_ok=True)
                        except Exception as e:
                            st.error(f"Couldn't generate audio: {e}")
                if last_idx in st.session_state.rk_audio_cache:
                    st.audio(st.session_state.rk_audio_cache[last_idx], format="audio/mp3")

    st.markdown("</div>", unsafe_allow_html=True)

st.markdown(
    '<div class="rk-footer-note">OnioRakshak — built for farmers in Maharashtra 🧅</div>',
    unsafe_allow_html=True,
)
