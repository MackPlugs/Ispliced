//! Tempo and rhythmic description of a decoded loop.
//!
//! The key detector already reads an 8-second mono window. This module reuses
//! that window to describe how the loop moves: an onset envelope from spectral
//! flux, a tempo from its autocorrelation, and a handful of shape statistics.
//! Those values extend the timbre-only similarity embedding and give the
//! catalogue matcher a tempo when the file name does not carry one.

use std::f32::consts::PI;

use realfft::RealFftPlanner;

/// Number of values appended to the timbre embedding.
pub const RHYTHM_FEATURES: usize = 8;

const FRAME_SIZE: usize = 1024;
const HOP_SIZE: usize = 512;
const MIN_BPM: f32 = 60.0;
const MAX_BPM: f32 = 200.0;
const LOW_BAND_HZ: f32 = 200.0;
const HIGH_BAND_HZ: f32 = 2000.0;
const ONSET_THRESHOLD: f32 = 0.5;

pub struct RhythmProfile {
    pub bpm: Option<u32>,
    pub features: [f32; RHYTHM_FEATURES],
}

/// Describes `samples`, which must already be mono at `rate`.
pub fn analyze(samples: &[f32], rate: u32) -> RhythmProfile {
    if samples.len() < FRAME_SIZE || rate == 0 {
        return RhythmProfile { bpm: None, features: [0.0; RHYTHM_FEATURES] };
    }

    let envelope = onset_envelope(samples, rate);
    let bpm = tempo(&envelope.flux, rate);
    let onset_rate = onset_rate(&envelope.flux, samples.len(), rate);
    let (flux_mean, flux_variance) = flux_shape(&envelope.flux);
    let clarity = pulse_clarity(&envelope.flux, rate);

    let mut features = [0.0f32; RHYTHM_FEATURES];
    features[0] = bpm.map_or(0.0, |value| (value as f32 / MAX_BPM).clamp(0.0, 1.0));
    features[1] = (onset_rate / 12.0).clamp(0.0, 1.0);
    features[2] = flux_mean.clamp(0.0, 1.0);
    features[3] = flux_variance.clamp(0.0, 1.0);
    features[4] = clarity;
    features[5] = ratio(envelope.low_energy, envelope.total_energy);
    features[6] = ratio(envelope.high_energy, envelope.total_energy);
    features[7] = crest_factor(samples);

    RhythmProfile { bpm, features }
}

struct Envelope {
    flux: Vec<f32>,
    low_energy: f32,
    high_energy: f32,
    total_energy: f32,
}

fn onset_envelope(samples: &[f32], rate: u32) -> Envelope {
    let mut planner = RealFftPlanner::<f32>::new();
    let rfft = planner.plan_fft_forward(FRAME_SIZE);
    let mut input = rfft.make_input_vec();
    let mut output = rfft.make_output_vec();
    let window = hann_window();

    let low_bin = (LOW_BAND_HZ * FRAME_SIZE as f32 / rate as f32) as usize;
    let high_bin = (HIGH_BAND_HZ * FRAME_SIZE as f32 / rate as f32) as usize;
    let mut previous = vec![0.0f32; output.len()];
    let mut flux = Vec::with_capacity(samples.len() / HOP_SIZE + 1);
    let mut low_energy = 0.0;
    let mut high_energy = 0.0;
    let mut total_energy = 0.0;

    for start in (0..samples.len().saturating_sub(FRAME_SIZE)).step_by(HOP_SIZE) {
        for index in 0..FRAME_SIZE {
            input[index] = samples[start + index] * window[index];
        }
        rfft.process(&mut input, &mut output).expect("the frame sizes match");

        let mut frame_flux = 0.0;
        for (bin, value) in output.iter().enumerate() {
            let magnitude = value.norm();
            let delta = magnitude - previous[bin];
            if delta > 0.0 {
                frame_flux += delta;
            }
            previous[bin] = magnitude;

            let power = magnitude * magnitude;
            total_energy += power;
            if bin <= low_bin {
                low_energy += power;
            }
            if bin >= high_bin {
                high_energy += power;
            }
        }
        flux.push(frame_flux);
    }

    Envelope { flux, low_energy, high_energy, total_energy }
}

fn hann_window() -> Vec<f32> {
    (0..FRAME_SIZE)
        .map(|index| 0.5 - 0.5 * (2.0 * PI * index as f32 / (FRAME_SIZE - 1) as f32).cos())
        .collect()
}

fn onset_rate(flux: &[f32], samples: usize, rate: u32) -> f32 {
    if flux.is_empty() || rate == 0 {
        return 0.0;
    }

    let (mean, deviation) = mean_and_deviation(flux);
    let threshold = mean + ONSET_THRESHOLD * deviation;
    let peaks = flux
        .windows(3)
        .filter(|window| window[1] >= window[0] && window[1] > window[2] && window[1] > threshold)
        .count();

    peaks as f32 / (samples as f32 / rate as f32)
}

fn flux_shape(flux: &[f32]) -> (f32, f32) {
    let peak = flux.iter().copied().fold(0.0f32, f32::max);
    if peak <= 0.0 {
        return (0.0, 0.0);
    }

    let (mean, deviation) = mean_and_deviation(flux);
    ((mean / peak).clamp(0.0, 1.0), (deviation / peak).clamp(0.0, 1.0))
}

/// Autocorrelation of the onset envelope, with a fractional-lag refinement.
fn tempo(flux: &[f32], rate: u32) -> Option<u32> {
    // A beat period rarely lands on a whole frame. Upsampling the envelope keeps
    // the correlation peak strong instead of splitting it across two lags.
    const OVERSAMPLE: usize = 4;
    let envelope = upsample(flux, OVERSAMPLE);
    let envelope_rate = rate as f32 / HOP_SIZE as f32 * OVERSAMPLE as f32;
    let min_lag = (envelope_rate * 60.0 / MAX_BPM).floor().max(1.0) as usize;
    let max_lag = (envelope_rate * 60.0 / MIN_BPM).ceil() as usize;
    if envelope.len() <= max_lag + 1 {
        return None;
    }

    let centred = subtract_mean(&envelope);
    let scores: Vec<f32> = (min_lag..=max_lag)
        .map(|lag| autocorrelation(&centred, lag))
        .collect();
    let max_score = scores.iter().copied().fold(f32::NEG_INFINITY, f32::max);
    if max_score <= 0.0 {
        return None;
    }

    // Half- and double-time lags correlate almost as well as the true period.
    // Take the fastest lag within 60% of the best so 120 BPM does not read as 60,
    // then climb to the local peak so a broad plateau does not pull the result flat.
    let threshold = max_score * 0.6;
    let mut best = scores.iter().position(|score| *score >= threshold)?;
    while best + 1 < scores.len() && scores[best + 1] > scores[best] {
        best += 1;
    }

    let lag = refined_lag(&scores, best, min_lag);
    let bpm = 60.0 * envelope_rate / lag;
    (MIN_BPM..=MAX_BPM).contains(&bpm).then_some(bpm.round() as u32)
}

fn upsample(values: &[f32], factor: usize) -> Vec<f32> {
    if values.len() < 2 {
        return values.to_vec();
    }

    let mut output = Vec::with_capacity(values.len() * factor);
    for pair in values.windows(2) {
        for step in 0..factor {
            let t = step as f32 / factor as f32;
            output.push(pair[0] * (1.0 - t) + pair[1] * t);
        }
    }
    output.push(*values.last().unwrap_or(&0.0));
    output
}

/// Parabolic interpolation around the best whole frame lag.
fn refined_lag(scores: &[f32], best: usize, min_lag: usize) -> f32 {
    let lag = (best + min_lag) as f32;
    if best == 0 || best + 1 >= scores.len() {
        return lag;
    }

    let left = scores[best - 1];
    let middle = scores[best];
    let right = scores[best + 1];
    let denominator = left - 2.0 * middle + right;
    if denominator.abs() < f32::EPSILON {
        return lag;
    }

    (lag + 0.5 * (left - right) / denominator).clamp(lag - 1.0, lag + 1.0)
}

fn pulse_clarity(flux: &[f32], rate: u32) -> f32 {
    let envelope_rate = rate as f32 / HOP_SIZE as f32;
    let min_lag = (envelope_rate * 60.0 / MAX_BPM).floor().max(1.0) as usize;
    let max_lag = (envelope_rate * 60.0 / MIN_BPM).ceil() as usize;
    if flux.len() <= max_lag + 1 {
        return 0.0;
    }

    let centred = subtract_mean(flux);
    let energy = autocorrelation(&centred, 0);
    if energy <= 0.0 {
        return 0.0;
    }

    let best = (min_lag..=max_lag)
        .map(|lag| autocorrelation(&centred, lag))
        .fold(0.0f32, f32::max);
    (best / energy).clamp(0.0, 1.0)
}

fn autocorrelation(values: &[f32], lag: usize) -> f32 {
    if lag >= values.len() {
        return 0.0;
    }

    let pairs = values.len() - lag;
    values.iter().zip(&values[lag..]).map(|(a, b)| a * b).sum::<f32>() / pairs as f32
}

fn subtract_mean(values: &[f32]) -> Vec<f32> {
    let (mean, _) = mean_and_deviation(values);
    values.iter().map(|value| value - mean).collect()
}

fn mean_and_deviation(values: &[f32]) -> (f32, f32) {
    if values.is_empty() {
        return (0.0, 0.0);
    }

    let mean = values.iter().sum::<f32>() / values.len() as f32;
    let variance = values.iter().map(|value| (value - mean).powi(2)).sum::<f32>() / values.len() as f32;
    (mean, variance.sqrt())
}

fn ratio(part: f32, whole: f32) -> f32 {
    if whole <= 0.0 {
        return 0.0;
    }
    (part / whole).clamp(0.0, 1.0)
}

/// Peak-to-RMS, normalised so a brickwalled loop reads near 1 and a dynamic one near 0.
fn crest_factor(samples: &[f32]) -> f32 {
    let peak = samples.iter().fold(0.0f32, |peak, value| peak.max(value.abs()));
    if peak <= 0.0 {
        return 0.0;
    }

    let rms = (samples.iter().map(|value| value * value).sum::<f32>() / samples.len() as f32).sqrt();
    if rms <= 0.0 {
        return 0.0;
    }

    (peak / rms / 10.0).clamp(0.0, 1.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn click_track(bpm: f32, rate: u32, seconds: usize) -> Vec<f32> {
        let mut samples = vec![0.0f32; rate as usize * seconds];
        let period = rate as f32 * 60.0 / bpm;
        let mut position = 0.0f32;

        while (position as usize) < samples.len() {
            let start = position as usize;
            for offset in 0..120 {
                if start + offset >= samples.len() {
                    break;
                }
                samples[start + offset] = (-(offset as f32) / 40.0).exp() * 0.9;
            }
            position += period;
        }
        samples
    }

    #[test]
    fn finds_the_tempo_of_a_click_track() {
        let profile = analyze(&click_track(120.0, 22050, 8), 22050);
        let bpm = profile.bpm.expect("a tempo");
        assert!((bpm as i32 - 120).abs() <= 2, "detected {bpm}");
    }

    #[test]
    fn distinguishes_slow_and_fast_loops() {
        let slow = analyze(&click_track(80.0, 22050, 8), 22050).bpm.expect("slow tempo");
        let fast = analyze(&click_track(160.0, 22050, 8), 22050).bpm.expect("fast tempo");

        assert!((slow as i32 - 80).abs() <= 2, "detected {slow}");
        assert!((fast as i32 - 160).abs() <= 2, "detected {fast}");
    }

    #[test]
    fn silence_has_no_tempo() {
        let profile = analyze(&vec![0.0f32; 22050 * 8], 22050);
        assert_eq!(profile.bpm, None);
        assert_eq!(profile.features, [0.0; RHYTHM_FEATURES]);
    }

    #[test]
    fn features_stay_within_zero_and_one() {
        let profile = analyze(&click_track(128.0, 22050, 8), 22050);
        assert!(profile.features.iter().all(|value| (0.0..=1.0).contains(value)));
    }
}
