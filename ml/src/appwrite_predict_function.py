"""
OnioRakshak - Appwrite Function: Real-time shelf-life inference

Deploy this as an Appwrite Function (Python runtime).

Trigger (set in Appwrite Console -> Functions -> your function -> Settings -> Events):
    databases.<DATABASE_ID>.collections.<SENSOR_COLLECTION_ID>.documents.*.create

Flow:
    1. ESP32 creates a new document in the sensor-readings collection.
    2. This function fires automatically (event-triggered, runs as an
       async background job -- no 30s limit applies here).
    3. It loads the trained model, builds the feature row, predicts
       shelf-life days + risk status, and writes a document into a
       `predictions` collection.
    4. The dashboard reads/subscribes to `predictions`.
       The ESP32 can poll (or subscribe via Realtime) the same
       collection to decide whether to switch on the fan/curtain/buzzer.

Deployment notes:
    - Bundle shelf_life_regressor.joblib and risk_classifier.joblib
      alongside this file (or fetch them from Appwrite Storage on cold
      start and cache in /tmp).
    - Add scikit-learn, joblib, pandas to requirements.txt for the
      function's build.
    - Set DATABASE_ID / PREDICTIONS_COLLECTION_ID as function
      environment variables rather than hardcoding them.
"""

import json
import os

import joblib
import pandas as pd
from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.id import ID

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
REGRESSOR = joblib.load(os.path.join(MODEL_DIR, "shelf_life_regressor.joblib"))
CLASSIFIER = joblib.load(os.path.join(MODEL_DIR, "risk_classifier.joblib"))

NUMERIC_FEATURES = [
    "initial_quality_score",
    "curing_score",
    "temperature_C",
    "relative_humidity_pct",
    "mq135_gas_index",
    "avg_temperature_24h_C",
    "avg_humidity_24h_pct",
    "avg_mq135_24h",
    "hours_temp_above_27C_24h",
    "hours_RH_above_65pct_24h",
    "storage_day",
]
CATEGORICAL_FEATURES = ["variety", "storage_mode"]


def main(context):
    client = (
        Client()
        .set_endpoint(os.environ["APPWRITE_FUNCTION_API_ENDPOINT"])
        .set_project(os.environ["APPWRITE_FUNCTION_PROJECT_ID"])
        .set_key(context.req.headers["x-appwrite-key"])
    )
    databases = Databases(client)

    database_id = os.environ["DATABASE_ID"]
    predictions_collection_id = os.environ["PREDICTIONS_COLLECTION_ID"]

    # The new sensor-reading document that triggered this function.
    reading = json.loads(context.req.body)

    row = pd.DataFrame([{
        "initial_quality_score": reading.get("initial_quality_score"),
        "curing_score": reading.get("curing_score"),
        "temperature_C": reading["temperature_C"],
        "relative_humidity_pct": reading["relative_humidity_pct"],
        "mq135_gas_index": reading["mq135_gas_index"],
        "avg_temperature_24h_C": reading["avg_temperature_24h_C"],
        "avg_humidity_24h_pct": reading["avg_humidity_24h_pct"],
        "avg_mq135_24h": reading["avg_mq135_24h"],
        "hours_temp_above_27C_24h": reading["hours_temp_above_27C_24h"],
        "hours_RH_above_65pct_24h": reading["hours_RH_above_65pct_24h"],
        "storage_day": reading["storage_day"],
        "variety": reading["variety"],
        "storage_mode": reading["storage_mode"],
    }])

    predicted_days = float(REGRESSOR.predict(row)[0])
    risk_status = str(CLASSIFIER.predict(row)[0])

    databases.create_document(
        database_id=database_id,
        collection_id=predictions_collection_id,
        document_id=ID.unique(),
        data={
            "batch_id": reading.get("batch_id"),
            "remaining_shelf_life_days": round(predicted_days, 1),
            "risk_status": risk_status,
            "source_reading_id": reading.get("$id"),
        },
    )

    context.log(f"Batch {reading.get('batch_id')}: {predicted_days:.1f} days, {risk_status}")
    return context.res.json({
        "remaining_shelf_life_days": round(predicted_days, 1),
        "risk_status": risk_status,
    })
