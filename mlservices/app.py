from flask import Flask, request, jsonify
import joblib
import numpy as np
from pathlib import Path

app = Flask(__name__)
BASE_DIR = Path(__file__).resolve().parent
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

# load model + scaler once
model = joblib.load(BASE_DIR / "model.pkl")
scaler = joblib.load(BASE_DIR / "scaler.pkl")

@app.route("/")
def home():
    return "ML API Running 🚀"

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.json or {}

        expected_feature_count = len(FEATURE_COLUMNS)
        scaler_feature_count = getattr(scaler, "n_features_in_", expected_feature_count)
        model_feature_count = getattr(model, "n_features_in_", expected_feature_count)

        if scaler_feature_count != expected_feature_count or model_feature_count != expected_feature_count:
            return jsonify({
                "error": (
                    "Model artifact mismatch. Expected "
                    f"{expected_feature_count} features from the app payload, "
                    f"but scaler expects {scaler_feature_count} and model expects {model_feature_count}. "
                    "Retrain the artifacts so they match the current form schema."
                )
            }), 500

        features = [float(data.get(column, 0)) for column in FEATURE_COLUMNS]

        features = np.array(features).reshape(1, -1)
        features = scaler.transform(features)

        prediction = model.predict(features)[0]

        return jsonify({
            "prediction": int(prediction)
        })

    except Exception as e:
        return jsonify({
            "error": str(e)
        })

if __name__ == "__main__":
    app.run(port=8000, debug=False)
