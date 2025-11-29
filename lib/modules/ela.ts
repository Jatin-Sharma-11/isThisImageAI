import { ELAResult } from "../types";
import { canvasToDataURL, getImageData } from "../utils";

export const analyzeELA = async (img: HTMLImageElement): Promise<ELAResult> => {
    const quality = 0.90; // Re-save quality
    const scale = 20; // Amplify difference

    // 1. Draw original to canvas
    const canvas1 = document.createElement("canvas");
    canvas1.width = img.width;
    canvas1.height = img.height;
    const ctx1 = canvas1.getContext("2d");
    if (!ctx1) throw new Error("No context");
    ctx1.drawImage(img, 0, 0);

    // 2. Export as JPEG
    const jpegUrl = canvas1.toDataURL("image/jpeg", quality);

    // 3. Load JPEG back
    const img2 = new Image();
    img2.src = jpegUrl;
    await new Promise((r) => (img2.onload = r));

    // 4. Draw re-saved image
    const canvas2 = document.createElement("canvas");
    canvas2.width = img.width;
    canvas2.height = img.height;
    const ctx2 = canvas2.getContext("2d");
    if (!ctx2) throw new Error("No context");
    ctx2.drawImage(img2, 0, 0);

    // 5. Compare pixels
    const data1 = ctx1.getImageData(0, 0, canvas1.width, canvas1.height);
    const data2 = ctx2.getImageData(0, 0, canvas2.width, canvas2.height);
    const diffData = ctx1.createImageData(canvas1.width, canvas1.height);

    let totalDiff = 0;

    for (let i = 0; i < data1.data.length; i += 4) {
        const rDiff = Math.abs(data1.data[i] - data2.data[i]);
        const gDiff = Math.abs(data1.data[i + 1] - data2.data[i + 1]);
        const bDiff = Math.abs(data1.data[i + 2] - data2.data[i + 2]);

        const avgDiff = (rDiff + gDiff + bDiff) / 3;
        totalDiff += avgDiff;

        // Amplify for visualization
        diffData.data[i] = rDiff * scale;
        diffData.data[i + 1] = gDiff * scale;
        diffData.data[i + 2] = bDiff * scale;
        diffData.data[i + 3] = 255;
    }

    // Calculate variance of the difference
    let sumDiff = 0;
    let sumSqDiff = 0;
    const numPixels = data1.data.length / 4;

    // We only care about the amplified difference values we calculated
    // But we need to re-loop or store them. Let's re-loop for simplicity or better, compute during first loop.
    // Actually, let's use the diffData we just filled.

    for (let i = 0; i < diffData.data.length; i += 4) {
        // Get the average amplified difference for this pixel
        const val = (diffData.data[i] + diffData.data[i + 1] + diffData.data[i + 2]) / 3;
        sumDiff += val;
        sumSqDiff += val * val;
    }

    const mean = sumDiff / numPixels;
    const variance = (sumSqDiff / numPixels) - (mean * mean);

    // Heuristic Refined:
    // 1. Extremely low mean (< 5 after amplification) => "Too clean" (Synthetic or simple vector art) => High AI Score
    // 2. High mean (> 50) => Noisy/Compressed => Low AI Score (likely real low quality)
    // 3. Low Variance => Uniform error => Suspicious
    // 4. High Variance => Complex error patterns => Likely Real (Edges have more error than flat areas)

    let score = 0;

    // Regional Analysis - Check different parts of image
    const regions = 4; // 2x2 grid
    const regionWidth = Math.floor(canvas1.width / 2);
    const regionHeight = Math.floor(canvas1.height / 2);
    const regionScores: number[] = [];

    for (let ry = 0; ry < 2; ry++) {
        for (let rx = 0; rx < 2; rx++) {
            let regionDiff = 0;
            let regionPixels = 0;

            for (let y = ry * regionHeight; y < (ry + 1) * regionHeight && y < canvas1.height; y++) {
                for (let x = rx * regionWidth; x < (rx + 1) * regionWidth && x < canvas1.width; x++) {
                    const i = (y * canvas1.width + x) * 4;
                    const val = (diffData.data[i] + diffData.data[i + 1] + diffData.data[i + 2]) / 3;
                    regionDiff += val;
                    regionPixels++;
                }
            }

            const regionMean = regionDiff / regionPixels;
            regionScores.push(regionMean);
        }
    }

    // Check for regional consistency (AI images often have very consistent ELA across regions)
    const regionMean = regionScores.reduce((a, b) => a + b, 0) / regionScores.length;
    const regionVariance = regionScores.reduce((sum, val) =>
        sum + Math.pow(val - regionMean, 2), 0) / regionScores.length;

    // Too consistent across regions = suspicious
    if (regionVariance < 50) {
        score += 0.3;
    }

    // Check for "Too Clean" (Synthetic)
    if (mean < 10) {
        score += 0.9; // Very strong indicator of synthetic generation
    } else if (mean < 20) {
        score += 0.6;
    } else if (mean < 35) {
        score += 0.3;
    }

    // Check for Uniformity (Low Variance relative to mean)
    // Real photos usually have high variance in ELA (edges light up, flat areas don't).
    // AI images (especially diffusion) often have more uniform noise or uniform lack of noise.

    if (variance < 100) {
        score += 0.6; // Very uniform
    } else if (variance < 300) {
        score += 0.4;
    } else if (variance > 1200) {
        score -= 0.3; // High variance (good sign of real manipulation/compression)
    }

    // Check coefficient of variation (normalized variance)
    const coefficientOfVariation = mean > 0 ? Math.sqrt(variance) / mean : 0;

    // Natural images typically have CV between 0.5 and 2.0
    if (coefficientOfVariation < 0.3) {
        score += 0.4; // Too uniform
    } else if (coefficientOfVariation > 0.5 && coefficientOfVariation < 1.5) {
        score -= 0.2; // Good variance pattern
    }

    // Clamp score
    score = Math.max(0, Math.min(1, score));

    return {
        score,
        dataUrl: canvasToDataURL(diffData),
    };
};
