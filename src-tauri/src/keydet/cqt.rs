use std::sync::{Arc, OnceLock};

use matrixmultiply::sgemm;
use realfft::{RealFftPlanner, RealToComplex};

use super::audio::ANALYSIS_SAMPLES;

pub const HOP: usize = 4096;
const PAD_SEMITONES: usize = 4;
const BINS_PER_OCTAVE: usize = 24;
const BINS_PER_SEMITONE: usize = BINS_PER_OCTAVE / 12;
pub const PAD_BINS: usize = PAD_SEMITONES * BINS_PER_SEMITONE;
pub const MODEL_BINS: usize = 192;
pub const FRAMES: usize = 1 + ANALYSIS_SAMPLES / HOP;

const MAGIC: &[u8; 8] = b"K10CQTV1";
const BASIS_BYTES: &[u8] = include_bytes!("../../resources/k10_cqt.bin");

struct Kernel {
    n_fft: usize,
    n_bins: usize,
    freq_bins: usize,
    scale: Vec<f32>,
    basis_re: Vec<f32>,
    basis_im: Vec<f32>,
    fft: Arc<dyn RealToComplex<f32>>,
}

static KERNEL: OnceLock<Kernel> = OnceLock::new();

fn kernel() -> &'static Kernel {
    KERNEL.get_or_init(|| parse_basis(BASIS_BYTES))
}

/// The 192 log-magnitude bins the K10 network expects, one row per bin.
pub fn features(samples: &[f32]) -> Vec<f32> {
    assert_eq!(samples.len(), ANALYSIS_SAMPLES, "analysis window has the wrong length");

    let kernel = kernel();
    let magnitude = magnitude(kernel, samples);

    let mut features = Vec::with_capacity(MODEL_BINS * FRAMES);
    for bin in PAD_BINS..PAD_BINS + MODEL_BINS {
        for frame in 0..FRAMES {
            features.push(magnitude[bin * FRAMES + frame].ln_1p());
        }
    }
    features
}

/// Calibrated magnitudes shaped `[n_bins][FRAMES]`.
fn magnitude(kernel: &Kernel, samples: &[f32]) -> Vec<f32> {
    let n_fft = kernel.n_fft;
    let freq_bins = kernel.freq_bins;

    let mut padded = vec![0.0f32; samples.len() + n_fft];
    padded[n_fft / 2..n_fft / 2 + samples.len()].copy_from_slice(samples);

    let mut buffer = kernel.fft.make_input_vec();
    let mut spectrum = kernel.fft.make_output_vec();

    let mut real = vec![0.0f32; FRAMES * freq_bins];
    let mut imaginary = vec![0.0f32; FRAMES * freq_bins];

    for frame in 0..FRAMES {
        let offset = frame * HOP;
        buffer.copy_from_slice(&padded[offset..offset + n_fft]);
        kernel.fft.process(&mut buffer, &mut spectrum).expect("in-place FFT");

        for (index, value) in spectrum.iter().enumerate() {
            real[frame * freq_bins + index] = value.re;
            imaginary[frame * freq_bins + index] = value.im;
        }
    }

    let mut product_re = vec![0.0f32; FRAMES * kernel.n_bins];
    let mut product_im = vec![0.0f32; FRAMES * kernel.n_bins];
    complex_product(kernel, &real, &imaginary, &mut product_re, &mut product_im);

    let mut magnitude = vec![0.0f32; kernel.n_bins * FRAMES];
    for bin in 0..kernel.n_bins {
        for frame in 0..FRAMES {
            let index = frame * kernel.n_bins + bin;
            let power = product_re[index] * product_re[index]
                + product_im[index] * product_im[index];
            magnitude[bin * FRAMES + frame] = power.sqrt() * kernel.scale[bin];
        }
    }
    magnitude
}

/// `frames x freq_bins` times `freq_bins x n_bins`, split into real and imaginary GEMMs.
fn complex_product(kernel: &Kernel, real: &[f32], imaginary: &[f32], out_re: &mut [f32], out_im: &mut [f32]) {
    let rows = FRAMES;
    let depth = kernel.freq_bins;
    let columns = kernel.n_bins;

    let row_stride = depth as isize;
    let basis_row_stride = 1;
    let basis_column_stride = depth as isize;
    let out_row_stride = columns as isize;

    // SAFETY: every buffer is sized rows*depth / depth*columns / rows*columns, and the
    // strides below describe those same layouts.
    unsafe {
        let a_re = real.as_ptr();
        let a_im = imaginary.as_ptr();
        let b_re = kernel.basis_re.as_ptr();
        let b_im = kernel.basis_im.as_ptr();
        let c_re = out_re.as_mut_ptr();
        let c_im = out_im.as_mut_ptr();

        sgemm(rows, depth, columns, 1.0, a_re, row_stride, 1, b_re, basis_row_stride, basis_column_stride, 0.0, c_re, out_row_stride, 1);
        sgemm(rows, depth, columns, -1.0, a_im, row_stride, 1, b_im, basis_row_stride, basis_column_stride, 1.0, c_re, out_row_stride, 1);
        sgemm(rows, depth, columns, 1.0, a_re, row_stride, 1, b_im, basis_row_stride, basis_column_stride, 0.0, c_im, out_row_stride, 1);
        sgemm(rows, depth, columns, 1.0, a_im, row_stride, 1, b_re, basis_row_stride, basis_column_stride, 1.0, c_im, out_row_stride, 1);
    }
}

fn parse_basis(bytes: &[u8]) -> Kernel {
    assert_eq!(&bytes[..8], MAGIC, "k10 CQT basis has an unexpected format");

    let n_bins = read_u32(bytes, 8) as usize;
    let n_fft = read_u32(bytes, 12) as usize;
    let freq_bins = read_u32(bytes, 16) as usize;
    assert_eq!(freq_bins, n_fft / 2 + 1, "k10 CQT basis has inconsistent dimensions");

    let mut offset = 20;
    let scale = read_f32s(bytes, offset, n_bins);
    offset += n_bins * 4;

    let count = n_bins * freq_bins;
    let mut basis_re = Vec::with_capacity(count);
    let mut basis_im = Vec::with_capacity(count);
    for index in 0..count {
        let base = offset + index * 8;
        basis_re.push(read_f32(bytes, base));
        basis_im.push(read_f32(bytes, base + 4));
    }

    let mut planner = RealFftPlanner::<f32>::new();
    Kernel {
        n_fft,
        n_bins,
        freq_bins,
        scale,
        basis_re,
        basis_im,
        fft: planner.plan_fft_forward(n_fft),
    }
}

fn read_u32(bytes: &[u8], offset: usize) -> u32 {
    u32::from_le_bytes(bytes[offset..offset + 4].try_into().expect("4 bytes"))
}

fn read_f32(bytes: &[u8], offset: usize) -> f32 {
    f32::from_le_bytes(bytes[offset..offset + 4].try_into().expect("4 bytes"))
}

fn read_f32s(bytes: &[u8], offset: usize, count: usize) -> Vec<f32> {
    (0..count).map(|index| read_f32(bytes, offset + index * 4)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_kernel_matches_the_exported_asset() {
        let kernel = kernel();
        assert_eq!(kernel.n_bins, 208);
        assert_eq!(kernel.n_fft, 32768);
        assert_eq!(kernel.freq_bins, 16385);
        assert_eq!(kernel.basis_re.len(), 208 * 16385);
    }

    #[test]
    fn features_have_the_expected_shape() {
        let samples = vec![0.0f32; ANALYSIS_SAMPLES];
        let features = features(&samples);
        assert_eq!(features.len(), MODEL_BINS * FRAMES);
        assert!(features.iter().all(|value| value.is_finite()));
    }

    #[test]
    fn a_silent_window_produces_no_energy() {
        let samples = vec![0.0f32; ANALYSIS_SAMPLES];
        assert!(features(&samples).iter().all(|value| *value == 0.0));
    }
}
