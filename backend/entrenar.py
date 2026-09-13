import joblib
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, brier_score_loss
from scipy.stats import spearmanr

from modelo import generar_dataset, entrenar, RUTA

X, y, p = generar_dataset()
Xtr, Xte, ytr, yte, _, pte = train_test_split(X, y, p, test_size=0.25, random_state=1)
m = entrenar(Xtr, ytr)
pred = m.predict_proba(Xte)[:, 1]

print(f"prevalencia    : {y.mean():.3f}")
print(f"AUC            : {roc_auc_score(yte, pred):.3f}")
print(f"Brier          : {brier_score_loss(yte, pred):.3f}")
print(f"spearman vs sim: {spearmanr(pred, pte).statistic:.3f}")

joblib.dump(m, RUTA)
print(f"guardado en {RUTA}")