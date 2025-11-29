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
    // AI images (GANs/Diffusion) often have:
    // 1. Bright spots (high magnitude) in high frequencies
    // 2. Specific grid patterns (periodic artifacts)
    // 3. Unusually smooth frequency spectrum (over-smoothed)

    // We will calculate the energy in different frequency bands
    let totalEnergy = 0;
    let lowFreqEnergy = 0;
    let midFreqEnergy = 0;
    let highFreqEnergy = 0;
    const center = size / 2;
    const innerRadius = size / 8;  // Low frequency
    const midRadius = size / 4;    // Mid frequency

    // Also track peak detection for grid artifacts
    const peaks: Array<{ x: number, y: number, mag: number }> = [];
    const peakThreshold = maxMag * 0.7; // Significant peaks

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const idx = y * size + x;
            const mag = magnitude[idx];

            // Distance from center (DC component is at center because we shifted)
            const dist = Math.sqrt(Math.pow(x - center, 2) + Math.pow(y - center, 2));

            totalEnergy += mag;

            if (dist <= innerRadius) {
                lowFreqEnergy += mag;
            } else if (dist <= midRadius) {
                midFreqEnergy += mag;
            } else {
                highFreqEnergy += mag;
            }

            // Detect peaks (excluding DC component at center)
            if (dist > 5 && mag > peakThreshold) {
                peaks.push({ x, y, mag });
            }
        }
    }

    const lowFreqRatio = lowFreqEnergy / totalEnergy;
    const midFreqRatio = midFreqEnergy / totalEnergy;
    const highFreqRatio = highFreqEnergy / totalEnergy;

    let score = 0;

    // 1. Check frequency distribution
    // Natural images have most energy in low frequencies
    // AI images can be too smooth (very high low freq ratio) or have artifacts (high freq peaks)

    if (lowFreqRatio > 0.95) {
        score += 0.5; // Too smooth, over-denoised (common in AI)
    } else if (lowFreqRatio < 0.7) {
        score += 0.2; // Unusual distribution
    }

    // 2. Check for high frequency artifacts
    if (highFreqRatio > 0.15) {
        score += 0.4; // Significant high frequency content (artifacts)
    }

    // 3. Detect grid patterns (periodic artifacts from GANs)
    // Look for symmetric peaks or regularly spaced peaks
    const gridPatterns = [];

    for (let i = 0; i < peaks.length; i++) {
        for (let j = i + 1; j < peaks.length; j++) {
            const dx = peaks[i].x - center;
            const dy = peaks[i].y - center;
            const dx2 = peaks[j].x - center;
            const dy2 = peaks[j].y - center;

            // Check for symmetry (opposite sides of center)
            if (Math.abs(dx + dx2) < 5 && Math.abs(dy + dy2) < 5) {
                gridPatterns.push({ peak1: peaks[i], peak2: peaks[j] });
            }

            // Check for regular spacing (grid)
            const spacing1 = Math.sqrt(dx * dx + dy * dy);
            const spacing2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
            if (Math.abs(spacing1 - spacing2) < spacing1 * 0.1) {
                const angle1 = Math.atan2(dy, dx);
                const angle2 = Math.atan2(dy2, dx2);
                const angleDiff = Math.abs(angle1 - angle2);

                // Check if angles are multiples of 90 degrees (grid pattern)
                const normalizedAngle = angleDiff % (Math.PI / 2);
                if (normalizedAngle < 0.2 || normalizedAngle > Math.PI / 2 - 0.2) {
                    gridPatterns.push({ peak1: peaks[i], peak2: peaks[j] });
                }
            }
        }
    }

    if (gridPatterns.length > 3) {
        score += 0.5; // Detected grid patterns (strong GAN indicator)
    } else if (gridPatterns.length > 0) {
        score += 0.2;
    }

    // 4. Check for specific "checkerboard" artifact frequencies
    // Checkerboard appears at Nyquist frequency (corners)
    let cornerEnergy = 0;
    const cornerSize = size / 16;

    const corners = [
        { x: 0, y: 0 },
        { x: size - cornerSize, y: 0 },
        { x: 0, y: size - cornerSize },
        { x: size - cornerSize, y: size - cornerSize }
    ];

    for (const corner of corners) {
        for (let y = corner.y; y < corner.y + cornerSize; y++) {
            for (let x = corner.x; x < corner.x + cornerSize; x++) {
                cornerEnergy += magnitude[y * size + x];
            }
        }
    }

    const cornerRatio = cornerEnergy / totalEnergy;
    if (cornerRatio > 0.05) {
        score += 0.4; // Significant corner energy (checkerboard artifacts)
    }

    return {
        score: Math.max(0, Math.min(1, score)),
        dataUrl: canvasToDataURL(spectrumData),
    };
};
