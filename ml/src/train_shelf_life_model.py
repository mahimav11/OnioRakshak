"""
OnioRakshak - Shelf-Life Prediction Model Training

Trains a regression model to predict `remaining_shelf_life_days` from
sensor readings and derived features. Also trains a companion classifier
that buckets the same readings into a Safe / Warning / Critical risk
status, used for actuator + dashboard alerts.

Usage:
    python src/train_shelf_life_model.py
"""

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    mean_absolute_error,
    r2_score,
)
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

DATA_PATH = "data/onion_shelf_life_dataset.csv"
MODEL_DIR = "models"

# NOTE: weight_loss_pct, decay_pct, and sprouting_pct are deliberately
# excluded even though they're strong predictors in this dataset. They are
# *symptoms* of spoilage, not something our ESP32 + DHT22/MQ135 sensor rig
# can actually measure in the field. Training on them would make offline
# metrics look great while being useless once wired to real hardware.
# Only include features the deployed sensors (or a one-time manual entry
# at batch intake) can actually supply.
NUMERIC_FEATURES = [
    "initial_quality_score",  # manual entry at intake (quality grading)
    "curing_score",  # manual entry at intake
    "temperature_C",
    "relative_humidity_pct",
    "mq135_gas_index",
    "avg_temperature_24h_C",
    "avg_humidity_24h_pct",
    "avg_mq135_24h",
    "hours_temp_above_27C_24h",
    "hours_RH_above_65pct_24h",
    "storage_day",  # known operationally (days since batch was stored)
]
CATEGORICAL_FEATURES = ["variety", "storage_mode"]
TARGET_REGRESSION = "remaining_shelf_life_days"


def make_risk_label(days: int) -> str:
    """Bucket remaining shelf-life days into a risk status.

    Thresholds are a starting point for the demo model — revisit these
    with the project guide once real sensor/spoilage data is available.
    """
    if days <= 7:
        return "Critical"
    if days <= 25:
        return "Warning"
    return "Safe"


def build_preprocessor() -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), NUMERIC_FEATURES),
            ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
        ]
    )


def main():
    df = pd.read_csv(DATA_PATH)
    df["risk_status"] = df[TARGET_REGRESSION].apply(make_risk_label)

    # Split by batch_id (GroupShuffleSplit) so rows from the same storage
    # batch never leak across train/test — batches share a trajectory, so a
    # plain random row split would let the model "see the future" of a
    # batch it's being tested on.
    splitter = GroupShuffleSplit(test_size=0.2, n_splits=1, random_state=42)
    train_idx, test_idx = next(splitter.split(df, groups=df["batch_id"]))
    train_df, test_df = df.iloc[train_idx], df.iloc[test_idx]

    X_train = train_df[NUMERIC_FEATURES + CATEGORICAL_FEATURES]
    X_test = test_df[NUMERIC_FEATURES + CATEGORICAL_FEATURES]
    y_train_reg = train_df[TARGET_REGRESSION]
    y_test_reg = test_df[TARGET_REGRESSION]
    y_train_clf = train_df["risk_status"]
    y_test_clf = test_df["risk_status"]

    # --- Regression: predicted remaining shelf-life in days ---
    reg_pipeline = Pipeline(
        steps=[
            ("preprocess", build_preprocessor()),
            (
                "model",
                RandomForestRegressor(
                    n_estimators=300, max_depth=None, random_state=42, n_jobs=-1
                ),
            ),
        ]
    )
    reg_pipeline.fit(X_train, y_train_reg)
    reg_preds = reg_pipeline.predict(X_test)

    print("=== Shelf-Life Regression ===")
    print(f"MAE:  {mean_absolute_error(y_test_reg, reg_preds):.2f} days")
    print(f"R^2:  {r2_score(y_test_reg, reg_preds):.3f}")

    # --- Classification: Safe / Warning / Critical risk status ---
    clf_pipeline = Pipeline(
        steps=[
            ("preprocess", build_preprocessor()),
            (
                "model",
                RandomForestClassifier(
                    n_estimators=300, max_depth=None, random_state=42, n_jobs=-1
                ),
            ),
        ]
    )
    clf_pipeline.fit(X_train, y_train_clf)
    clf_preds = clf_pipeline.predict(X_test)

    print("\n=== Storage Risk Classification ===")
    print(f"Accuracy: {accuracy_score(y_test_clf, clf_preds):.3f}")
    print(classification_report(y_test_clf, clf_preds))

    # --- Feature importance (regression model) ---
    ohe = reg_pipeline.named_steps["preprocess"].named_transformers_["cat"]
    feature_names = NUMERIC_FEATURES + list(ohe.get_feature_names_out(CATEGORICAL_FEATURES))
    importances = reg_pipeline.named_steps["model"].feature_importances_
    top_features = sorted(zip(feature_names, importances), key=lambda x: -x[1])[:8]
    print("\n=== Top Features (Regression) ===")
    for name, score in top_features:
        print(f"{name:30s} {score:.3f}")

    # --- Save trained pipelines ---
    joblib.dump(reg_pipeline, f"{MODEL_DIR}/shelf_life_regressor.joblib")
    joblib.dump(clf_pipeline, f"{MODEL_DIR}/risk_classifier.joblib")
    print(f"\nSaved models to {MODEL_DIR}/")


if __name__ == "__main__":
    main()
