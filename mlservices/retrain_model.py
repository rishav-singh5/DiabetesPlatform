from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "diabetesData.csv"
MODEL_PATH = BASE_DIR / "model.pkl"
SCALER_PATH = BASE_DIR / "scaler.pkl"

FEATURE_COLUMNS = [
    "Pregnancies",
    "Glucose",
    "BloodPressure",
    "SkinThickness",
    "Insulin",
    "BMI",
    "Age",
    "BMI_Category",
    "High_Glucose",
    "Age_Group"
]


def build_training_frame():
    df = pd.read_csv(DATA_PATH)

    df["BMI_Category"] = (df["BMI"] > 30).astype(int)
    df["High_Glucose"] = (df["Glucose"] > 140).astype(int)
    df["Age_Group"] = (df["Age"] > 40).astype(int)

    x = df[FEATURE_COLUMNS]
    y = df["Outcome"]
    return x, y


def main():
    x, y = build_training_frame()

    x_train, x_test, y_train, y_test = train_test_split(
        x, y, test_size=0.2, random_state=42
    )

    scaler = StandardScaler()
    x_train_scaled = scaler.fit_transform(x_train)
    x_test_scaled = scaler.transform(x_test)

    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=6,
        class_weight="balanced",
        random_state=42
    )
    model.fit(x_train_scaled, y_train)

    joblib.dump(model, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)

    accuracy = model.score(x_test_scaled, y_test)
    print(f"Saved model to {MODEL_PATH}")
    print(f"Saved scaler to {SCALER_PATH}")
    print(f"Feature count: {len(FEATURE_COLUMNS)}")
    print(f"Test accuracy: {accuracy:.4f}")


if __name__ == "__main__":
    main()
