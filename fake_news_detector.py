"""
Fake News Detector — Lightweight CPU Version
=============================================
Uses TF-IDF + Logistic Regression (no GPU needed, runs in ~1-2 minutes)

Install:
    pip install scikit-learn pandas numpy

Usage:
    python fake_news_detector.py --train fakenews.csv
    python fake_news_detector.py --predict "Your news article text here"
"""

import argparse
import os
import pickle
import numpy as np
import pandas as pd

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    classification_report,
    confusion_matrix,
)
from sklearn.pipeline import Pipeline

# ─── Config ───────────────────────────────────────────────────────────────────

MODEL_SAVE = "fakenews_model.pkl"

# ─── Data Loading ─────────────────────────────────────────────────────────────

def load_dataset(csv_path: str) -> pd.DataFrame:
    if not os.path.exists(csv_path):
        raise FileNotFoundError(
            f"\n  File not found: '{csv_path}'\n"
            f"  Make sure fakenews.csv is in the same folder.\n"
            f"  Current directory: {os.getcwd()}\n"
        )

    df = pd.read_csv(csv_path)
    df.columns = df.columns.str.lower().str.strip()

    # Combine title + text if both exist
    if "title" in df.columns and "text" in df.columns:
        df["text"] = df["title"].fillna("") + " " + df["text"].fillna("")
    elif "text" not in df.columns:
        raise ValueError("CSV must have a 'text' column.")

    if "label" not in df.columns:
        raise ValueError("CSV must have a 'label' column (0=real, 1=fake).")

    # Handle string labels
    if df["label"].dtype == object:
        df["label"] = df["label"].str.lower().map({"fake": 1, "real": 0, "0": 0, "1": 1})

    df = df[["text", "label"]].dropna()
    df["label"] = df["label"].astype(int)
    df["text"]  = df["text"].astype(str).str.strip()
    df = df[df["text"].str.len() > 10]

    print(f"\n  Dataset loaded: {len(df)} samples")
    print(f"  REAL (0): {(df.label==0).sum()}  |  FAKE (1): {(df.label==1).sum()}")
    return df

# ─── Training ─────────────────────────────────────────────────────────────────

def train_model(csv_path: str):
    print(f"\n{'='*58}")
    print("  Fake News Detector — TF-IDF + Logistic Regression")
    print("  Fast CPU mode  (no GPU / PyTorch needed)")
    print(f"{'='*58}")

    # 1. Load data
    df = load_dataset(csv_path)
    X = df["text"].tolist()
    y = df["label"].tolist()

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"\n  Train: {len(X_train)}  |  Test: {len(X_test)}\n")

    # 2. Build pipeline: TF-IDF -> Logistic Regression
    print("  Training model...")
    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(
            max_features=50000,   # top 50k words
            ngram_range=(1, 2),   # unigrams + bigrams
            sublinear_tf=True,    # log scaling
            min_df=2,             # ignore very rare words
            stop_words="english",
        )),
        ("clf", LogisticRegression(
            C=1.0,
            max_iter=1000,
            solver="lbfgs",
            n_jobs=-1,            # use all CPU cores
        )),
    ])

    pipeline.fit(X_train, y_train)
    print("  Training complete!\n")

    # 3. Evaluate
    y_pred = pipeline.predict(X_test)

    acc  = accuracy_score(y_test, y_pred)
    f1   = f1_score(y_test, y_pred, average="weighted")
    prec = precision_score(y_test, y_pred, average="weighted")
    rec  = recall_score(y_test, y_pred, average="weighted")
    cm   = confusion_matrix(y_test, y_pred)

    print(f"{'='*58}")
    print("  EVALUATION RESULTS")
    print(f"{'='*58}")
    print(f"  Accuracy  : {acc*100:.2f}%")
    print(f"  F1 Score  : {f1*100:.2f}%")
    print(f"  Precision : {prec*100:.2f}%")
    print(f"  Recall    : {rec*100:.2f}%")
    print(f"{'='*58}\n")

    print("  Classification Report:")
    print(classification_report(y_test, y_pred, target_names=["REAL", "FAKE"], digits=4))

    print("  Confusion Matrix:")
    print(f"                 Predicted REAL   Predicted FAKE")
    print(f"  Actual REAL        {cm[0][0]:^10}       {cm[0][1]:^10}")
    print(f"  Actual FAKE        {cm[1][0]:^10}       {cm[1][1]:^10}")
    print()

    # 4. Save model
    with open(MODEL_SAVE, "wb") as f:
        pickle.dump(pipeline, f)

    print(f"  Model saved to '{MODEL_SAVE}'")
    print(f"\n  Run a prediction:")
    print(f'  python fake_news_detector.py --predict "Your article here"\n')

# ─── Prediction ───────────────────────────────────────────────────────────────

def predict(text: str, model_path: str = MODEL_SAVE):
    if not os.path.exists(model_path):
        raise FileNotFoundError(
            f"\n  Model file '{model_path}' not found.\n"
            f"  Train first:  python fake_news_detector.py --train fakenews.csv\n"
        )

    with open(model_path, "rb") as f:
        pipeline = pickle.load(f)

    probs      = pipeline.predict_proba([text])[0]
    pred_label = int(np.argmax(probs))
    label_map  = {0: "REAL", 1: "FAKE"}

    bar_real = "█" * int(probs[0] * 30)
    bar_fake = "█" * int(probs[1] * 30)

    print("\n" + "=" * 56)
    print("   FAKE NEWS DETECTION RESULT")
    print("=" * 56)
    print(f"  Article   : {text[:72]}{'...' if len(text)>72 else ''}")
    print()
    print(f"  Verdict   : {'[REAL NEWS]' if pred_label == 0 else '[FAKE NEWS]'}")
    print(f"  Confidence: {probs[pred_label]*100:.1f}%")
    print()
    print(f"  P(REAL)   : {probs[0]*100:5.1f}%  {bar_real}")
    print(f"  P(FAKE)   : {probs[1]*100:5.1f}%  {bar_fake}")
    print("=" * 56)

    return label_map[pred_label], probs

# ─── Entry Point ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Fake News Detector (TF-IDF + Logistic Regression)",
        formatter_class=argparse.RawTextHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python fake_news_detector.py --train fakenews.csv\n"
            '  python fake_news_detector.py --predict "SHOCKING: Scientists EXPOSED hiding miracle cure!!"\n'
            '  python fake_news_detector.py --predict "Reuters: Fed raises rates by 25 basis points"\n'
        )
    )
    parser.add_argument("--train",   metavar="CSV",  help="Path to dataset CSV (e.g. fakenews.csv)")
    parser.add_argument("--predict", metavar="TEXT", help="Article text to classify")
    parser.add_argument("--model",   metavar="FILE", default=MODEL_SAVE,
                        help=f"Saved model file (default: {MODEL_SAVE})")
    args = parser.parse_args()

    if args.train:
        train_model(args.train)
    elif args.predict:
        predict(args.predict, model_path=args.model)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
