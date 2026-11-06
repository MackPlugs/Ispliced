use std::sync::OnceLock;

use tract_onnx::prelude::*;

use super::cqt::{FRAMES, MODEL_BINS};

const MODEL_BYTES: &[u8] = include_bytes!("../../resources/k10.onnx");

const HIGH_PROBABILITY: f32 = 0.7;
const MEDIUM_PROBABILITY: f32 = 0.4;
const CLASSES: usize = 24;
const NOTES: [&str; 12] = [
    "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

/// K10's class axis is `tonic * 2 + is_minor`.
type Runnable = SimplePlan<TypedFact, Box<dyn TypedOp>, TypedModel>;

static MODEL: OnceLock<Runnable> = OnceLock::new();

#[derive(Clone, Debug, serde::Serialize)]
pub struct KeyResult {
    pub tonic: u8,
    pub mode: String,
    pub label: String,
    pub confidence: String,
    pub probability: f32,
}

fn model() -> &'static Runnable {
    MODEL.get_or_init(|| {
        let mut cursor = std::io::Cursor::new(MODEL_BYTES);
        tract_onnx::onnx()
            .model_for_read(&mut cursor)
            .expect("k10 model is readable")
            .with_input_fact(0, f32::fact([1, 1, MODEL_BINS, FRAMES]).into())
            .expect("k10 accepts the analysis window")
            .into_optimized()
            .expect("k10 optimizes")
            .into_runnable()
            .expect("k10 is runnable")
    })
}

pub fn classify(features: &[f32]) -> Result<KeyResult, String> {
    let input = Tensor::from_shape(&[1, 1, MODEL_BINS, FRAMES], features)
        .map_err(|e| format!("bad feature shape: {e}"))?;

    let outputs = model()
        .run(tvec!(input.into()))
        .map_err(|e| format!("k10 inference failed: {e}"))?;

    let logits = outputs[0]
        .to_array_view::<f32>()
        .map_err(|e| format!("unexpected k10 output: {e}"))?;
    let logits = logits
        .as_slice()
        .ok_or_else(|| "k10 output is not contiguous".to_string())?;
    if logits.len() != CLASSES {
        return Err(format!("k10 returned {} classes, expected {CLASSES}", logits.len()));
    }

    let probabilities = softmax(logits);
    let best = argmax(&probabilities);
    Ok(describe(best, probabilities[best]))
}

fn softmax(logits: &[f32]) -> Vec<f32> {
    let max = logits.iter().copied().fold(f32::NEG_INFINITY, f32::max);
    let exponents: Vec<f32> = logits.iter().map(|value| (value - max).exp()).collect();
    let total: f32 = exponents.iter().sum();
    exponents.iter().map(|value| value / total).collect()
}

fn argmax(values: &[f32]) -> usize {
    let mut best = 0;
    for (index, value) in values.iter().enumerate() {
        if *value > values[best] {
            best = index;
        }
    }
    best
}

fn describe(class: usize, probability: f32) -> KeyResult {
    let tonic = (class / 2) as u8;
    let mode = if class % 2 == 1 { "min" } else { "maj" };

    KeyResult {
        tonic,
        mode: mode.to_string(),
        label: format!("{}{}", NOTES[tonic as usize], mode),
        confidence: confidence(probability).to_string(),
        probability,
    }
}

fn confidence(probability: f32) -> &'static str {
    if probability >= HIGH_PROBABILITY {
        "high"
    } else if probability >= MEDIUM_PROBABILITY {
        "medium"
    } else {
        "low"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn softmax_sums_to_one() {
        let probabilities = softmax(&[1.0, 2.0, 3.0, 4.0]);
        assert!((probabilities.iter().sum::<f32>() - 1.0).abs() < 1e-6);
    }

    #[test]
    fn argmax_breaks_ties_low() {
        assert_eq!(argmax(&[0.1, 0.9, 0.9]), 1);
    }

    #[test]
    fn classes_map_to_notes_and_modes() {
        assert_eq!(describe(0, 0.9).label, "Cmaj");
        assert_eq!(describe(1, 0.9).label, "Cmin");
        assert_eq!(describe(23, 0.5).label, "Bmin");
        assert_eq!(describe(9, 0.5).label, "Emin");
    }

    #[test]
    fn confidence_uses_the_k10_gates() {
        assert_eq!(confidence(0.7), "high");
        assert_eq!(confidence(0.4), "medium");
        assert_eq!(confidence(0.39), "low");
    }

    #[test]
    fn the_model_runs_on_a_silent_window() {
        let features = vec![0.0f32; MODEL_BINS * FRAMES];
        let result = classify(&features).expect("inference");
        assert!((0..CLASSES as u8).contains(&result.tonic));
        assert!(result.probability > 0.0);
    }
}
