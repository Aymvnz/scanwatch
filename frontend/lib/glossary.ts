export const GLOSSARY: { term: string; short: string; long: string }[] = [
  { term: "Baseline", short: "The reference dataset that current data is compared against.", long: "A baseline is a snapshot of data and performance from a period when the system was behaving as expected. Everything else is judged against it, so a poor baseline gives misleading comparisons." },
  { term: "Data drift", short: "The incoming data no longer looks like the reference data.", long: "Data drift means the distribution of inputs (for example image features, patient ages or missing values) has changed. It is a warning sign to investigate, not proof that the model is wrong." },
  { term: "Concept drift", short: "The relationship between inputs and outcomes has changed.", long: "With concept drift the same inputs now lead to different true outcomes, for example a new disease pattern or a change in how cases are confirmed. It can only be seen with confirmed outcome labels." },
  { term: "Sensitivity", short: "Of the people who truly have the finding, how many does the model flag?", long: "Sensitivity (recall) = TP / (TP + FN). Low sensitivity means more missed findings." },
  { term: "Specificity", short: "Of the people without the finding, how many does the model correctly clear?", long: "Specificity = TN / (TN + FP). Low specificity means more false alarms." },
  { term: "False negative", short: "The model said no finding, but there was one.", long: "A false negative is a missed case. The false-negative rate is FN / (TP + FN), which equals 1 minus sensitivity." },
  { term: "False positive", short: "The model flagged a finding that was not there.", long: "A false positive is a false alarm. The false-positive rate is FP / (FP + TN), which equals 1 minus specificity." },
  { term: "Calibration", short: "Do predicted probabilities match how often the finding really occurs?", long: "A well-calibrated model that says 80% is right about 80% of the time. ECE (expected calibration error) averages the gap across score bins; Brier score is the mean squared error of the scores. A model can be accurate yet poorly calibrated." },
  { term: "PSI", short: "Population Stability Index: how far a distribution has moved.", long: "PSI compares the share of records in each bin of the reference data with the share in the current data. Bins come from the reference only. Common rules of thumb: under 0.10 small, 0.10 to 0.25 moderate, over 0.25 large. These are conventions, not clinical thresholds." },
  { term: "KS test", short: "Kolmogorov–Smirnov test: could two samples come from the same distribution?", long: "The KS statistic is the largest gap between two cumulative distributions, with a p-value. With large samples it flags tiny differences, and with many features some flags are false positives, so ScanWatch adjusts p-values and also requires a meaningful PSI." },
  { term: "MMD", short: "Maximum Mean Discrepancy: a joint test across several features.", long: "MMD measures the distance between two multivariate distributions using a kernel. ScanWatch uses an RBF kernel and a permutation test for the p-value. It can notice changes in how features combine, but results depend on kernel and sample choices." },
];

export const FOUR_QUESTIONS = [
  { q: "Data drift", a: "Has the incoming data changed? Needs no outcome labels." },
  { q: "Model accuracy", a: "Is the model still right as often as before? Needs confirmed outcomes." },
  { q: "Calibration", a: "Do its scores still mean what they say? Needs confirmed outcomes." },
  { q: "Clinical risk", a: "Could errors harm patients? Needs clinical judgement; no statistic here answers it." },
];
