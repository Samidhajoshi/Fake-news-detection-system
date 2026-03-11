"""
Fake News Detector using DistilBERT  (CPU-friendly)
=====================================================
Uses DistilBERT instead of full BERT — 40% faster, same accuracy.

Install:
    pip install transformers torch scikit-learn pandas numpy tqdm

Usage:
    python fake_news_detector.py --train fakenews.csv
    python fake_news_detector.py --predict "Your news article text here"
"""

import argparse
import os
import warnings
import logging
import numpy as np
import pandas as pd
from tqdm import tqdm

# Suppress noisy warnings
warnings.filterwarnings("ignore")
logging.getLogger("transformers").setLevel(logging.ERROR)
os.environ["TOKENIZERS_PARALLELISM"] = "false"

import torch
from torch.utils.data import Dataset, DataLoader
from torch.optim import AdamW

from transformers import (
    DistilBertTokenizerFast,
    DistilBertForSequenceClassification,
    get_linear_schedule_with_warmup,
)
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    classification_report,
    accuracy_score,
    f1_score,
)

# ─── Configuration ────────────────────────────────────────────────────────────

# DistilBERT = 40% faster than BERT, ~97% of its accuracy, great for CPU
MODEL_NAME    = "distilbert-base-uncased"
MAX_LEN       = 128        # reduced from 256 = 4x faster tokenization on CPU
BATCH_SIZE    = 8          # small batch for CPU memory
EPOCHS        = 3
LEARNING_RATE = 2e-5
MODEL_SAVE    = "bert_fakenews_model"
DEVICE        = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ─── Dataset ──────────────────────────────────────────────────────────────────

class FakeNewsDataset(Dataset):
    def __init__(self, texts, labels, tokenizer, max_len=MAX_LEN):
        # Tokenize everything upfront (faster than per-item)
        self.encodings = tokenizer(
            texts,
            add_special_tokens=True,
            max_length=max_len,
            padding="max_length",
            truncation=True,
            return_attention_mask=True,
        )
        self.labels = labels

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        return {
            "input_ids":      torch.tensor(self.encodings["input_ids"][idx],      dtype=torch.long),
            "attention_mask": torch.tensor(self.encodings["attention_mask"][idx], dtype=torch.long),
            "label":          torch.tensor(self.labels[idx],                      dtype=torch.long),
        }

# ─── Data loading ─────────────────────────────────────────────────────────────

def load_dataset(csv_path: str) -> pd.DataFrame:
    """
    Loads CSV. Expected columns: title (optional), text, label
    label: 0 = REAL, 1 = FAKE  (or string 'real'/'fake')
    """
    if not os.path.exists(csv_path):
        raise FileNotFoundError(
            f"\n  File not found: '{csv_path}'\n"
            f"  Make sure fakenews.csv is in the same folder as this script.\n"
            f"  Current directory: {os.getcwd()}\n"
        )

    df = pd.read_csv(csv_path)
    df.columns = df.columns.str.lower().str.strip()

    # Combine title + text if both present
    if "title" in df.columns and "text" in df.columns:
        df["text"] = df["title"].fillna("") + " " + df["text"].fillna("")
    elif "text" not in df.columns:
        raise ValueError("CSV must have a 'text' column.")

    if "label" not in df.columns:
        raise ValueError("CSV must have a 'label' column (0=real, 1=fake).")

    # Handle string labels like 'fake' / 'real'
    if df["label"].dtype == object:
        df["label"] = df["label"].str.lower().map({"fake": 1, "real": 0, "0": 0, "1": 1})

    df = df[["text", "label"]].dropna()
    df["label"] = df["label"].astype(int)
    df["text"]  = df["text"].astype(str).str.strip()
    df = df[df["text"].str.len() > 10]   # drop blank rows

    print(f"\n  Dataset loaded: {len(df)} samples")
    print(f"  REAL (0): {(df.label==0).sum()}  |  FAKE (1): {(df.label==1).sum()}")
    return df

# ─── Training ─────────────────────────────────────────────────────────────────

def train_model(csv_path: str):
    print(f"\n{'='*58}")
    print("  Fake News Detector — DistilBERT Fine-tuning")
    print(f"  Device : {DEVICE}")
    print(f"  Model  : {MODEL_NAME}")
    print(f"  Epochs : {EPOCHS}  |  Batch: {BATCH_SIZE}  |  MaxLen: {MAX_LEN}")
    print(f"{'='*58}")

    # 1. Load data
    df = load_dataset(csv_path)
    train_df, val_df = train_test_split(
        df, test_size=0.15, random_state=42, stratify=df["label"]
    )
    print(f"  Train: {len(train_df)}  |  Val: {len(val_df)}\n")

    # 2. Tokenizer + model (downloads ~260MB once, cached after)
    print("Loading DistilBERT (first run downloads ~260 MB)...")
    tokenizer = DistilBertTokenizerFast.from_pretrained(MODEL_NAME)
    model     = DistilBertForSequenceClassification.from_pretrained(
        MODEL_NAME, num_labels=2
    )
    model.to(DEVICE)
    print("Model ready\n")

    # 3. Tokenize all texts upfront
    print("Tokenizing dataset...")
    train_ds = FakeNewsDataset(train_df["text"].tolist(), train_df["label"].tolist(), tokenizer)
    val_ds   = FakeNewsDataset(val_df["text"].tolist(),   val_df["label"].tolist(),   tokenizer)
    print("Done\n")

    # num_workers=0 avoids Windows multiprocessing pickle errors
    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True,  num_workers=0)
    val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

    # 4. Optimizer + LR scheduler
    optimizer = AdamW(model.parameters(), lr=LEARNING_RATE, eps=1e-8)
    total_steps = len(train_loader) * EPOCHS
    scheduler = get_linear_schedule_with_warmup(
        optimizer,
        num_warmup_steps=int(0.1 * total_steps),
        num_training_steps=total_steps,
    )

    # 5. Training loop
    best_val_f1 = 0.0

    for epoch in range(1, EPOCHS + 1):
        print(f"{'─'*58}")
        print(f"  Epoch {epoch} / {EPOCHS}")
        print(f"{'─'*58}")

        # Train
        model.train()
        total_loss = 0.0

        for batch in tqdm(train_loader, desc="  Training", unit="batch"):
            input_ids      = batch["input_ids"].to(DEVICE)
            attention_mask = batch["attention_mask"].to(DEVICE)
            labels         = batch["label"].to(DEVICE)

            optimizer.zero_grad()
            outputs = model(input_ids=input_ids, attention_mask=attention_mask, labels=labels)
            loss = outputs.loss
            total_loss += loss.item()

            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            scheduler.step()

        avg_loss = total_loss / len(train_loader)
        print(f"\n  Train Loss : {avg_loss:.4f}")

        # Validate
        model.eval()
        all_preds, all_labels = [], []

        with torch.no_grad():
            for batch in tqdm(val_loader, desc="  Validating", unit="batch"):
                input_ids      = batch["input_ids"].to(DEVICE)
                attention_mask = batch["attention_mask"].to(DEVICE)
                labels         = batch["label"].to(DEVICE)

                outputs = model(input_ids=input_ids, attention_mask=attention_mask)
                preds   = torch.argmax(outputs.logits, dim=1)
                all_preds.extend(preds.cpu().numpy())
                all_labels.extend(labels.cpu().numpy())

        acc = accuracy_score(all_labels, all_preds)
        f1  = f1_score(all_labels, all_preds, average="weighted")

        print(f"\n  +----------------------------------+")
        print(f"  |  Val Accuracy :  {acc*100:6.2f}%         |")
        print(f"  |  Val F1 Score :  {f1*100:6.2f}%         |")
        print(f"  +----------------------------------+\n")
        print(classification_report(
            all_labels, all_preds,
            target_names=["REAL", "FAKE"],
            digits=4
        ))

        if f1 > best_val_f1:
            best_val_f1 = f1
            model.save_pretrained(MODEL_SAVE)
            tokenizer.save_pretrained(MODEL_SAVE)
            print(f"  Best model saved to '{MODEL_SAVE}/'  (F1={f1:.4f})\n")

    print(f"\n{'='*58}")
    print(f"  Training complete!")
    print(f"  Best Validation F1 : {best_val_f1:.4f}")
    print(f"  Model saved to     : {MODEL_SAVE}/")
    print(f"{'='*58}\n")
    print("Run a prediction:")
    print('  python fake_news_detector.py --predict "Your article here"')

# ─── Prediction ───────────────────────────────────────────────────────────────

def predict(text: str, model_dir: str = MODEL_SAVE):
    if not os.path.exists(model_dir):
        raise FileNotFoundError(
            f"\n  Model folder '{model_dir}' not found.\n"
            f"  Train first:  python fake_news_detector.py --train fakenews.csv\n"
        )

    print(f"\nLoading model from '{model_dir}'...")
    tokenizer = DistilBertTokenizerFast.from_pretrained(model_dir)
    model     = DistilBertForSequenceClassification.from_pretrained(model_dir)
    model.to(DEVICE)
    model.eval()

    encoding = tokenizer(
        text,
        add_special_tokens=True,
        max_length=MAX_LEN,
        padding="max_length",
        truncation=True,
        return_attention_mask=True,
        return_tensors="pt",
    )

    with torch.no_grad():
        outputs = model(
            input_ids=encoding["input_ids"].to(DEVICE),
            attention_mask=encoding["attention_mask"].to(DEVICE),
        )

    probs      = torch.softmax(outputs.logits, dim=1).cpu().numpy()[0]
    pred_label = int(np.argmax(probs))
    label_map  = {0: "REAL", 1: "FAKE"}

    bar_real = "█" * int(probs[0] * 30)
    bar_fake = "█" * int(probs[1] * 30)

    print("\n" + "=" * 54)
    print("   FAKE NEWS DETECTION RESULT")
    print("=" * 54)
    print(f"  Article   : {text[:75]}{'...' if len(text)>75 else ''}")
    print()
    print(f"  Verdict   : {'[REAL NEWS]' if pred_label == 0 else '[FAKE NEWS]'}")
    print(f"  Confidence: {probs[pred_label]*100:.1f}%")
    print()
    print(f"  P(REAL)   : {probs[0]*100:5.1f}%  {bar_real}")
    print(f"  P(FAKE)   : {probs[1]*100:5.1f}%  {bar_fake}")
    print("=" * 54)

    return label_map[pred_label], probs

# ─── Entry point ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Fake News Detector using DistilBERT",
        formatter_class=argparse.RawTextHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python fake_news_detector.py --train fakenews.csv\n"
            '  python fake_news_detector.py --predict "Doctors expose miracle cure hidden by Big Pharma!!"\n'
            '  python fake_news_detector.py --predict "Reuters: Fed raises rates by 25 basis points"\n'
        )
    )
    parser.add_argument("--train",   metavar="CSV",  help="Path to dataset CSV (e.g. fakenews.csv)")
    parser.add_argument("--predict", metavar="TEXT", help="Article text to classify")
    parser.add_argument("--model",   metavar="DIR",  default=MODEL_SAVE,
                        help=f"Saved model folder (default: {MODEL_SAVE})")
    args = parser.parse_args()

    if args.train:
        train_model(args.train)
    elif args.predict:
        predict(args.predict, model_dir=args.model)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()