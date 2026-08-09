import os
import numpy as np
from sklearn.ensemble import IsolationForest
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType

def main():
    print("Training IsolationForest model for Metrological Certificate Anomaly Detection...")
    
    # Generate realistic training data (12 feature dimensions)
    # Features:
    # 0: Temp (21.0 - 25.0)
    # 1: Humidity (30.0 - 75.0)
    # 2: Days to expiry (10 - 365)
    # 3: Max Error (0.001 - 0.5)
    # 4: Max Correction (-0.5 - 0.5)
    # 5: Max Uncertainty (0.001 - 0.1)
    # 6: Guard Band Ratio (0.1 - 0.9)
    # 7: Hysteresis Delta (0.0 - 0.1)
    # 8: Stamp (1.0)
    # 9: Signature (1.0)
    # 10: Page Discrepancy (0.0)
    # 11: Total Points (1.0 - 50.0)
    
    np.random.seed(42)
    n_samples = 1000
    
    # Normal samples
    X_normal = np.column_stack([
        np.random.uniform(21.0, 25.0, n_samples),
        np.random.uniform(30.0, 75.0, n_samples),
        np.random.uniform(30, 365, n_samples),
        np.random.uniform(0.001, 0.2, n_samples),
        np.random.uniform(-0.1, 0.1, n_samples),
        np.random.uniform(0.001, 0.05, n_samples),
        np.random.uniform(0.1, 0.8, n_samples),
        np.random.uniform(0.0, 0.05, n_samples),
        np.ones(n_samples),
        np.ones(n_samples),
        np.zeros(n_samples),
        np.random.uniform(1.0, 30.0, n_samples)
    ])
    
    # Fit IsolationForest
    model = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
    model.fit(X_normal)
    
    # Convert to ONNX format
    initial_type = [('float_input', FloatTensorType([None, 12]))]
    onnx_model = convert_sklearn(model, initial_types=initial_type)
    
    # Save to models directory
    out_dir = os.path.join(os.path.dirname(__file__), "models")
    os.makedirs(out_dir, exist_ok=True)
    model_path = os.path.join(out_dir, "isolation_forest.onnx")
    
    with open(model_path, "wb") as f:
        f.write(onnx_model.SerializeToString())
        
    print(f"Successfully exported Isolation Forest model to: {model_path} ({os.path.getsize(model_path)} bytes)")

if __name__ == "__main__":
    main()
