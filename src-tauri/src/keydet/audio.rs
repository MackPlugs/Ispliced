use std::path::Path;

use hound::{SampleFormat, WavReader};
use rubato::{
    Resampler, SincFixedIn, SincInterpolationParameters, SincInterpolationType, WindowFunction,
};

pub const TARGET_RATE: u32 = 22050;
pub const ANALYSIS_SECONDS: usize = 8;
pub const ANALYSIS_SAMPLES: usize = ANALYSIS_SECONDS * TARGET_RATE as usize;

const RESAMPLE_CHUNK: usize = 1024;
const MAX_RESAMPLE_RATIO: f64 = 2.0;
const SINC_LENGTH: usize = 128;
const CUTOFF: f32 = 0.95;
const OVERSAMPLING: usize = 256;
const READ_MARGIN_SECONDS: usize = 1;

/// Decodes a written WAV to mono at the model's rate, then tiles or trims it to the
/// fixed analysis window so the network always sees one input shape.
pub fn read_window(path: &Path) -> Result<Vec<f32>, String> {
    let mono = read_mono(path)?;
    Ok(analysis_window(&mono))
}

fn read_mono(path: &Path) -> Result<Vec<f32>, String> {
    let mut reader =
        WavReader::open(path).map_err(|e| format!("cannot read {}: {e}", path.display()))?;
    let spec = reader.spec();
    let limit = source_frame_limit(spec.sample_rate, spec.channels as usize);

    let interleaved = match spec.sample_format {
        SampleFormat::Float => reader
            .samples::<f32>()
            .take(limit)
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("cannot decode {}: {e}", path.display()))?,
        SampleFormat::Int => {
            let scale = 1.0 / (1i64 << (spec.bits_per_sample - 1)) as f32;
            reader
                .samples::<i32>()
                .take(limit)
                .map(|s| s.map(|v| v as f32 * scale))
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| format!("cannot decode {}: {e}", path.display()))?
        }
    };

    let mono = mixdown(&interleaved, spec.channels as usize);
    resample(&mono, spec.sample_rate, TARGET_RATE)
}

/// Interleaved sample count for the analysis window plus one second of resampler margin.
fn source_frame_limit(rate: u32, channels: usize) -> usize {
    let frames = (ANALYSIS_SECONDS + READ_MARGIN_SECONDS) as u64 * u64::from(rate);
    (frames as usize).saturating_mul(channels.max(1))
}

fn mixdown(interleaved: &[f32], channels: usize) -> Vec<f32> {
    if channels <= 1 {
        return interleaved.to_vec();
    }

    let gain = 1.0 / channels as f32;
    interleaved
        .chunks_exact(channels)
        .map(|frame| frame.iter().sum::<f32>() * gain)
        .collect()
}

fn resample(input: &[f32], source_rate: u32, target_rate: u32) -> Result<Vec<f32>, String> {
    if source_rate == target_rate || input.is_empty() {
        return Ok(input.to_vec());
    }

    let ratio = target_rate as f64 / source_rate as f64;
    let params = SincInterpolationParameters {
        sinc_len: SINC_LENGTH,
        f_cutoff: CUTOFF,
        interpolation: SincInterpolationType::Linear,
        oversampling_factor: OVERSAMPLING,
        window: WindowFunction::BlackmanHarris2,
    };

    let mut resampler =
        SincFixedIn::<f32>::new(ratio, MAX_RESAMPLE_RATIO, params, RESAMPLE_CHUNK, 1)
            .map_err(|e| format!("cannot build resampler: {e}"))?;

    let mut output = Vec::with_capacity((input.len() as f64 * ratio) as usize + RESAMPLE_CHUNK);
    for block in input.chunks(RESAMPLE_CHUNK) {
        let mut padded = block.to_vec();
        padded.resize(RESAMPLE_CHUNK, 0.0);

        let produced = resampler
            .process(&[padded], None)
            .map_err(|e| format!("resample failed: {e}"))?;
        output.extend_from_slice(&produced[0]);
    }

    output.truncate((input.len() as f64 * ratio).round() as usize);
    Ok(output)
}

fn analysis_window(samples: &[f32]) -> Vec<f32> {
    if samples.len() >= ANALYSIS_SAMPLES {
        return samples[..ANALYSIS_SAMPLES].to_vec();
    }

    let mut window = Vec::with_capacity(ANALYSIS_SAMPLES);
    while window.len() < ANALYSIS_SAMPLES {
        let take = (ANALYSIS_SAMPLES - window.len()).min(samples.len());
        window.extend_from_slice(&samples[..take]);
    }
    window
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn short_input_is_tiled_to_the_window() {
        let looped = analysis_window(&[0.5; 1000]);
        assert_eq!(looped.len(), ANALYSIS_SAMPLES);
        assert_eq!(looped[0], 0.5);
    }

    #[test]
    fn long_input_is_trimmed_to_the_window() {
        let looped = analysis_window(&vec![0.25; ANALYSIS_SAMPLES + 500]);
        assert_eq!(looped.len(), ANALYSIS_SAMPLES);
    }

    #[test]
    fn stereo_is_averaged() {
        assert_eq!(mixdown(&[1.0, 0.0, 0.5, 0.5], 2), vec![0.5, 0.5]);
    }
}
