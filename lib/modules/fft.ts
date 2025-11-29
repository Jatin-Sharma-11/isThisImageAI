import { FFTResult } from "../types";
import FFT from "fft.js";
import { canvasToDataURL } from "../utils";

export const analyzeFFT = async (img: HTMLImageElement): Promise<FFTResult> => {
    const size = 512; // Power of 2 for FFT
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No context");

    // Draw and resize
    ctx.drawImage(img, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;

    // Convert to grayscale
    const grayData = new Array(size * size);
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        grayData[i / 4] = 0.299 * r + 0.587 * g + 0.114 * b;
    }

    // Initialize FFT
    const f = new FFT(size);
    const input = new Array(size * size * 2); // Real and Imaginary parts
    const output = new Array(size * size * 2);

    // Fill input (row by row)
    // Note: 2D FFT is separable. We can do rows then columns.
    // But fft.js is 1D. We need to handle 2D manually or use a library that supports 2D.
    // For simplicity/speed in this demo, we'll do a 1D FFT on rows, then transpose, then 1D FFT on columns.

    // Actually, let's just do a simple visualization of high-frequency content using a high-pass filter
    // because full 2D FFT in JS might be heavy and complex to implement from scratch with 1D lib.
    // WAIT, I should try to do it properly if possible.
    // Let's stick to a simpler approach: High Pass Filter visualization which is often used as a proxy for frequency analysis in forensics.
    // OR, use the 1D FFT on the center row/col to detect periodicity.

    // Let's try a simplified 2D FFT implementation using the 1D library.

    const real = new Array(size * size).fill(0);
    const imag = new Array(size * size).fill(0);

    // Copy grayscale to real
    for (let i = 0; i < grayData.length; i++) {
        real[i] = grayData[i];
    }

    // FFT Rows
    const rowFFT = new FFT(size);
    const rowIn = new Array(size * 2);
    const rowOut = new Array(size * 2);

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            rowIn[x * 2] = real[y * size + x];
            rowIn[x * 2 + 1] = imag[y * size + x];
        }
        rowFFT.transform(rowOut, rowIn);
        for (let x = 0; x < size; x++) {
            real[y * size + x] = rowOut[x * 2];
            imag[y * size + x] = rowOut[x * 2 + 1];
        }
    }

    // FFT Cols (Transpose -> FFT -> Transpose back, or just access column-wise)
    const colFFT = new FFT(size);
    const colIn = new Array(size * 2);
    const colOut = new Array(size * 2);

    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            colIn[y * 2] = real[y * size + x];
            colIn[y * 2 + 1] = imag[y * size + x];
        }
        colFFT.transform(colOut, colIn);
        for (let y = 0; y < size; y++) {
            real[y * size + x] = colOut[y * 2];
            imag[y * size + x] = colOut[y * 2 + 1];
        }
    }

    // Compute Magnitude and Shift (center DC)
    const magnitude = new Array(size * size);
    let maxMag = 0;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const r = real[y * size + x];
            const i = imag[y * size + x];
            let mag = Math.sqrt(r * r + i * i);
            mag = Math.log(mag + 1); // Log scale

            // Shift quadrants
            const yShift = (y + size / 2) % size;
            const xShift = (x + size / 2) % size;
            const idx = yShift * size + xShift;

            magnitude[idx] = mag;
            if (mag > maxMag) maxMag = mag;
        }
    }

    // Visualize
    const spectrumData = ctx.createImageData(size, size);
    for (let i = 0; i < magnitude.length; i++) {
        const val = (magnitude[i] / maxMag) * 255;
        spectrumData.data[i * 4] = val;
        spectrumData.data[i * 4 + 1] = val;
        spectrumData.data[i * 4 + 2] = val;
        spectrumData.data[i * 4 + 3] = 255;
    }

    // Heuristic:
    // AI images (GANs) often have bright spots (high magnitude) in high frequencies (outer regions)
    // or specific grid patterns.

    // We will calculate the energy in the "High Frequency" region vs "Low Frequency" region.
    // Low Freq: Center circle. High Freq: Corners/Edges.

    let totalEnergy = 0;
    let highFreqEnergy = 0;
    const center = size / 2;
    const lowFreqRadius = size / 8; // Inner circle

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const idx = y * size + x;
            const mag = magnitude[idx];

            // Distance from center (DC component is at center because we shifted)
            const dist = Math.sqrt(Math.pow(x - center, 2) + Math.pow(y - center, 2));

            totalEnergy += mag;

            if (dist > lowFreqRadius) {
                highFreqEnergy += mag;
            }
        }
    }

    const highFreqRatio = highFreqEnergy / totalEnergy;

    // Typical natural images have most energy in low frequencies (ratio is low).
    // AI images with checkerboard artifacts have more energy in high frequencies.
    // Also, if the image is too smooth (denoised), high freq energy might be abnormally low?
    // Actually, GAN artifacts usually manifest as *peaks* in high freq.

    // Let's look for "spikes" in high freq.
    // Calculate variance of high freq magnitude?

    // Simplified Heuristic for this demo:
    // If high freq ratio is unusually high (> 0.85), it might be noisy or AI artifacts.
    // If it's unusually low (< 0.5), it might be too smooth (AI).

    let score = 0;

    // Tuning these thresholds is tricky without a dataset.
    // But generally, AI images have specific "peaks".
    // Let's stick to the "Too Smooth" vs "Artifacts" check.

    if (highFreqRatio > 0.90) {
        score += 0.3; // Very high frequency noise (could be grain or artifacts)
    } else if (highFreqRatio < 0.6) {
        score += 0.5; // Unusually smooth (AI often suppresses texture)
    }

    // Check for specific "Grid" artifacts (peaks at regular intervals)
    // This is hard to do robustly in 1 pass.

    // Let's just return a moderate score if we detect "smoothness" which correlates with the ELA "clean" check.

    return {
        score: Math.max(0, Math.min(1, score)),
        dataUrl: canvasToDataURL(spectrumData),
    };
};
