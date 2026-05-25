---
title: "Bias in AI and ML: Taxonomy, Detection, and Mitigation"
date: 2026-04-08
tags: machine-learning, ai, bias, fairness, ethics, mlops, python
---

# Bias in AI and ML: Taxonomy, Detection, and Mitigation

A model can achieve 95% accuracy while systematically discriminating against a demographic group. It can pass every benchmark in the evaluation suite and still fail catastrophically when deployed on the actual population it serves. Bias in machine learning is not a calibration problem — it is a property of data, processes, and incentives that must be diagnosed and addressed at every stage of the ML lifecycle.

This post provides a structured taxonomy of bias types (following ISO/IEC TR 24027:2021 and NIST AI RMF 1.0), detection methods for each, mitigation strategies at three pipeline stages, and formal definitions of the fairness metrics used to quantify outcomes.

---

## Why Accuracy Is Not Enough

Before defining bias types, it is worth illustrating why a high-accuracy model can still be badly biased.

Suppose a binary classifier predicts loan repayment. The dataset contains 900 majority-group applicants (80% repay) and 100 minority-group applicants (60% repay). A classifier that approves nobody from the minority group and 80% of majority-group applicants can achieve 88% overall accuracy — yet it denies the majority of creditworthy minority applicants.

The confusion matrix per group tells a completely different story than the aggregate accuracy metric. This is the **accuracy paradox**: aggregate performance hides disparate impact.

---

## Taxonomy of Bias Types

### 1. Historical Bias

**Definition:** Bias present in the real world that is reflected in the data, even when data collection is technically correct.

**Example:** A hiring model trained on historical promotion records learns that women hold fewer senior positions — not because women are less qualified, but because past promotion decisions were discriminatory. The model replicates and perpetuates this pattern.

**Detection:** Examine base rates of the target variable across demographic groups in the training data. A disparity in base rates that is inconsistent with known ground-truth rates signals historical bias.

**Mitigation:** Reweighting samples, generating counterfactual training examples, or pre-processing labels to remove historical discrimination signals.

---

### 2. Representation Bias

**Definition:** The training distribution does not accurately represent the deployment population.

**Example:** A facial recognition system trained primarily on lighter-skinned faces has error rates 10–34% higher on darker-skinned faces (Buolamwini & Gebru, 2018). The training set is not representative of the global population the system will evaluate.

**Detection:** Compare demographic breakdowns of the training set against the known or estimated deployment population. Use subgroup performance analysis — evaluate accuracy, F1, and calibration separately for each group.

```python
import pandas as pd
from sklearn.metrics import classification_report

def subgroup_report(y_true, y_pred, groups):
    df = pd.DataFrame({"y_true": y_true, "y_pred": y_pred, "group": groups})
    for group, subset in df.groupby("group"):
        print(f"\n--- Group: {group} ---")
        print(classification_report(subset["y_true"], subset["y_pred"]))
```

**Mitigation:** Targeted data collection for underrepresented groups; stratified sampling to balance group representation.

---

### 3. Measurement Bias

**Definition:** Systematic errors in how features or labels are measured across groups.

**Example:** A recidivism prediction model uses arrest records as a proxy for criminal activity. Policing is not uniform — certain communities are policed more intensively, producing more arrests for the same rate of underlying offences. The feature (arrest count) measures not just criminal activity but also policing intensity.

**Detection:** Audit the measurement process for each feature. Ask: does the measurement have the same fidelity and error rate across all groups? Use correlation analysis between sensitive attributes and proxy features.

**Mitigation:** Remove or transform proxy features; use causal modelling to identify features confounded with sensitive attributes.

---

### 4. Aggregation Bias

**Definition:** A single model is applied to a heterogeneous population when different subgroups have meaningfully different relationships between features and the target variable.

**Example:** A diabetes risk model trained on a mixed population may have lower predictive accuracy for ethnic subgroups with different HbA1c-to-risk mappings. Aggregating all groups into one model suppresses this heterogeneity.

**Detection:** Train separate models per subgroup and compare performance. If the per-group models substantially outperform the aggregate model for some groups, aggregation bias is present.

**Mitigation:** Train subgroup-specific models; use multi-task learning with group-specific heads; or use mixture-of-experts architectures.

---

### 5. Evaluation Bias

**Definition:** The benchmark or test set is not representative of the deployment population, producing misleadingly high evaluation scores.

**Example:** A speech recognition model is evaluated on a clean, studio-recorded benchmark. Deployment in noisy real-world environments (call centres, street interviews) degrades performance, especially for speakers with non-standard accents that are underrepresented in the benchmark.

**Detection:** Evaluate on held-out sets that explicitly mirror deployment conditions. Use multiple benchmarks with different demographic compositions.

**Mitigation:** Construct evaluation sets that are representative of all deployment subpopulations; report per-subgroup metrics alongside aggregate metrics.

---

### 6. Deployment Bias

**Definition:** A model is used in a context that differs from the one it was designed for, often in ways its developers did not anticipate.

**Example:** A risk score designed to flag patients for additional medical review is used by administrators to deny care. The model was validated for triage; its outputs are not calibrated for access decisions.

**Detection:** Document intended use cases and monitor how the model is actually used in production. Conduct red-team exercises to identify foreseeable misuse.

**Mitigation:** Restrict model output to intended use cases in the API contract; implement monitoring and alerting for out-of-distribution use; provide model cards (Mitchell et al., 2019) with explicit use and anti-use sections.

---

### 7. Feedback Loop Bias

**Definition:** Model predictions influence future data collection, which feeds back into future model training, amplifying initial biases over time.

**Example:** A predictive policing model increases patrols in certain areas. More patrols produce more arrests in those areas. More arrests in the training data reinforce the model's prediction that those areas are high-crime. The feedback loop concentrates policing regardless of actual crime rates.

**Detection:** Simulate the feedback loop before deployment. Track the distributional shift in training data over time; measure whether group disparities in model outputs are widening across training iterations.

**Mitigation:** Break the feedback loop by diversifying data collection; apply counterfactual evaluation; introduce diversity constraints in active learning pipelines.

---

## Fairness Metrics: Formal Definitions

Let `Ŷ` be the predicted label, `Y` be the true label, and `A` be the sensitive attribute (e.g., race, gender). All metrics assume a binary prediction problem.

### Demographic Parity (Statistical Parity)

```
P(Ŷ = 1 | A = 0) = P(Ŷ = 1 | A = 1)
```

The positive prediction rate is equal across groups. This is a group-level constraint — it says nothing about individual accuracy. A model that randomly assigns positive predictions to balance group rates satisfies demographic parity but is useless.

### Equalized Odds (Hardt, Price, Srebro 2016)

```
P(Ŷ = 1 | A = 0, Y = y) = P(Ŷ = 1 | A = 1, Y = y)    for y ∈ {0, 1}
```

Both the True Positive Rate (TPR) and False Positive Rate (FPR) are equal across groups. This is a stronger constraint: the model must perform equally well — and fail equally — across groups.

**Equal Opportunity** (a relaxation) requires only equal TPR:
```
P(Ŷ = 1 | A = 0, Y = 1) = P(Ŷ = 1 | A = 1, Y = 1)
```

### Predictive Parity (Calibration)

```
P(Y = 1 | Ŷ = 1, A = 0) = P(Y = 1 | Ŷ = 1, A = 1)
```

Among all individuals predicted positive, the precision is equal across groups. A model satisfies predictive parity if a score of 0.7 means the same thing regardless of group membership.

### Impossibility Result

Chouldechova (2017) and Kleinberg et al. (2016) independently proved: for any classifier with unequal base rates across groups, it is **impossible** to simultaneously satisfy demographic parity, equalized odds, and predictive parity. Choosing which fairness criterion to optimise is a normative policy decision, not a technical one.

```python
def fairness_metrics(y_true, y_pred, sensitive):
    from sklearn.metrics import confusion_matrix
    import numpy as np

    results = {}
    for group in np.unique(sensitive):
        mask = sensitive == group
        tn, fp, fn, tp = confusion_matrix(y_true[mask], y_pred[mask]).ravel()
        results[group] = {
            "selection_rate": (tp + fp) / len(y_true[mask]),
            "tpr":            tp / (tp + fn) if (tp + fn) > 0 else 0,
            "fpr":            fp / (fp + tn) if (fp + tn) > 0 else 0,
            "precision":      tp / (tp + fp) if (tp + fp) > 0 else 0,
        }
    return results
```

---

## Mitigation Strategies

### Pre-processing: Modify the Training Data

| Technique | Description |
|---|---|
| Reweighting | Assign higher sample weights to underrepresented subgroups |
| Resampling | Oversample minority group examples (SMOTE, ADASYN) |
| Disparate impact remover | Transform feature values to reduce correlation with sensitive attributes while preserving rank-ordering within groups (Feldman et al., 2015) |
| Label flipping | Identify and correct historically biased labels using counterfactual analysis |

### In-processing: Modify the Learning Algorithm

| Technique | Description |
|---|---|
| Fairness constraints | Add regularisation terms penalising demographic parity violations (Zafar et al., 2017) |
| Adversarial debiasing | Train an adversary to predict the sensitive attribute from the model's intermediate representations; penalise predictability (Zhang et al., 2018) |
| Reductions approach | Reduce fairness-constrained classification to a sequence of cost-sensitive classification problems (Agarwal et al., 2018) |

### Post-processing: Modify Model Outputs

| Technique | Description |
|---|---|
| Threshold adjustment | Set separate classification thresholds per group to equalise TPR or FPR |
| Calibrated equalized odds | Find optimal threshold combinations that satisfy equalized odds constraints (Hardt et al., 2016) |
| Reject option classification | Abstain from prediction in uncertain cases, which are disproportionately the cases where bias is most harmful |

```python
def equalise_opportunity_thresholds(y_true, y_scores, sensitive):
    """
    Find per-group thresholds that equalise TPR across groups.
    Returns {group: threshold}.
    """
    from sklearn.metrics import roc_curve
    import numpy as np

    # Find global TPR at default threshold (0.5)
    global_mask = y_scores >= 0.5
    global_tpr = np.sum((global_mask == 1) & (y_true == 1)) / np.sum(y_true == 1)

    thresholds = {}
    for group in np.unique(sensitive):
        mask = sensitive == group
        fpr, tpr, thresh = roc_curve(y_true[mask], y_scores[mask])
        # Find threshold where TPR is closest to global_tpr
        idx = np.argmin(np.abs(tpr - global_tpr))
        thresholds[group] = thresh[idx]
    return thresholds
```

---

## Standards and Frameworks

| Standard / Framework | Scope |
|---|---|
| **ISO/IEC TR 24027:2021** — Bias in AI systems | Taxonomy of bias in AI; definitions and categorisation |
| **ISO/IEC TR 24368:2022** — AI ethics | Ethical principles and governance for AI |
| **NIST AI RMF 1.0 (2023)** — AI Risk Management Framework | Risk identification, measurement, management for AI systems |
| **IEEE 7003-2023** — Algorithmic Bias Considerations | Standard for addressing bias in autonomous and intelligent systems |
| **EU AI Act (2024)** — Regulation (EU) 2024/1689 | Legally binding requirements for high-risk AI systems including bias assessment |
| **EEOC Uniform Guidelines (1978)** — 29 CFR Part 1607 | US employment law: "adverse impact" standard (80% rule) for hiring tools |

---

## Real-World Failures

**COMPAS Recidivism Tool (ProPublica, 2016):** A tool used by US courts to predict criminal recidivism was found to have roughly equal predictive accuracy across racial groups but markedly unequal false positive rates — Black defendants were roughly twice as likely to be incorrectly flagged as high-risk compared to white defendants. This is a violation of equalized odds even when predictive parity holds (illustrating the impossibility result in practice).

**Amazon Hiring Tool (2018):** A résumé screening model trained on historical hires learned to penalise terms associated with women (e.g., "women's chess club"). The model was encoding the historical gender imbalance of the technology workforce. Amazon discontinued the tool.

**Dermatology Diagnosis (Adamson & Smith, 2018):** Deep learning models for skin lesion classification had significantly higher error rates for darker skin tones because publicly available training datasets were heavily skewed toward lighter-skinned patients — a clear case of representation bias with clinical consequences.

---

## Checklist: Bias Audit at Each Pipeline Stage

| Stage | Questions |
|---|---|
| Data collection | Is the sample representative of the deployment population? Are measurement errors uniform across groups? Are labels free of historical discrimination? |
| Feature engineering | Do any features serve as proxies for sensitive attributes? Is correlation with sensitive attributes measured and documented? |
| Model training | Are subgroup performance metrics (not just aggregate) tracked during training? Are fairness constraints applied where mandated? |
| Evaluation | Is the test set demographically representative? Are subgroup metrics reported alongside aggregate metrics? |
| Deployment | Is the model used for its intended purpose? Is monitoring in place to detect distributional shift and emerging disparate impact? |
| Feedback | Is the feedback loop between predictions and future training data documented and controlled? |

---

**References**

- [ISO/IEC TR 24027:2021 — Information technology — Artificial intelligence — Bias in AI systems and AI aided decision making](https://www.iso.org/standard/77607.html)
- [NIST AI Risk Management Framework (AI RMF 1.0), NIST AI 100-1 (2023)](https://airc.nist.gov/RMF_Overview)
- [IEEE 7003-2023 — IEEE Standard for Algorithmic Bias Considerations](https://standards.ieee.org/ieee/7003/10277/)
- [EU AI Act — Regulation (EU) 2024/1689 of the European Parliament and of the Council](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ:L_202401689)
- [Buolamwini, J. & Gebru, T. (2018). Gender Shades: Intersectional Accuracy Disparities in Commercial Gender Classification. Proceedings of Machine Learning Research, 81, 1–15](http://proceedings.mlr.press/v81/buolamwini18a.html)
- [Hardt, M., Price, E., & Srebro, N. (2016). Equality of Opportunity in Supervised Learning. NeurIPS 2016](https://proceedings.neurips.cc/paper/2016/hash/9d2682367c3935defcb1f9e247a97c0d-Abstract.html)
- [Chouldechova, A. (2017). Fair Prediction with Disparate Impact: A Study of Bias in Recidivism Prediction Instruments. Big Data, 5(2), 153–163](https://www.liebertpub.com/doi/10.1089/big.2016.0047)
- [Mehrabi, N. et al. (2021). A Survey on Bias and Fairness in Machine Learning. ACM Computing Surveys, 54(6)](https://dl.acm.org/doi/10.1145/3457607)
- [Mitchell, M. et al. (2019). Model Cards for Model Reporting. Proceedings of the ACM Conference on Fairness, Accountability, and Transparency (FAccT 2019)](https://dl.acm.org/doi/10.1145/3287560.3287596)
- [Barocas, S., Hardt, M., & Narayanan, A. (2023). Fairness and Machine Learning: Limitations and Opportunities. MIT Press](https://fairmlbook.org/)
- [ProPublica — Machine Bias: There's Software Used Across the Country to Predict Future Criminals (2016)](https://www.propublica.org/article/machine-bias-risk-assessments-in-criminal-sentencing)
