import { ColorAnalysisResult } from "../types";
import { canvasToDataURL } from "../utils";

export const analyzeColor = async (img: HTMLImageElement): Promise<ColorAnalysisResult> => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No context");

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Initialize histograms
    const rHist = new Array(256).fill(0);
    const gHist = new Array(256).fill(0);
    const bHist = new Array(256).fill(0);
    const satHist = new Array(256).fill(0);

    let totalSaturation = 0;
    let clippedHighlights = 0;
    let clippedShadows = 0;
    let totalPixels = data.length / 4;

    // Analyze each pixel
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Update histograms
        rHist[r]++;
        gHist[g]++;
        bHist[b]++;

        // Calculate saturation (HSV)
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max === 0 ? 0 : ((max - min) / max) * 255;
        satHist[Math.floor(saturation)]++;
        totalSaturation += saturation;

        // Check for clipping
        if (r >= 250 && g >= 250 && b >= 250) clippedHighlights++;
        if (r <= 5 && g <= 5 && b <= 5) clippedShadows++;
    }

    let score = 0;

    // 1. Check for unnatural color distribution
    // AI images often have "peaks" in histogram at specific values
    const histogramPeaks = (hist: number[]) => {
        let peaks = 0;
        for (let i = 1; i < hist.length - 1; i++) {
            if (hist[i] > hist[i - 1] * 1.5 && hist[i] > hist[i + 1] * 1.5) {
                if (hist[i] > totalPixels * 0.02) { // Significant peak
                    peaks++;
                }
            }
        }
        return peaks;
    };

    const rPeaks = histogramPeaks(rHist);
    const gPeaks = histogramPeaks(gHist);
    const bPeaks = histogramPeaks(bHist);

    // AI images often have fewer distinct peaks (smoother distribution)
    if (rPeaks + gPeaks + bPeaks < 10) {
        score += 0.3; // Too smooth color distribution
    }

    // 2. Check saturation
    const avgSaturation = totalSaturation / totalPixels;

    // AI images often have either unnaturally high or low saturation
    if (avgSaturation > 180) {
        score += 0.4; // Oversaturated (common in AI art)
    } else if (avgSaturation < 30) {
        score += 0.2; // Undersaturated (some AI generators)
    }

    // 3. Check for color clipping
    const clippingRatio = (clippedHighlights + clippedShadows) / totalPixels;

    // AI images often have unnatural clipping
    if (clippingRatio > 0.15) {
        score += 0.3; // Too much clipping
    }

    // 4. Check color variance
    const colorVariance = (hist: number[]) => {
        const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
        const variance = hist.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / hist.length;
        return variance;
    };

    const rVar = colorVariance(rHist);
    const gVar = colorVariance(gHist);
    const bVar = colorVariance(bHist);
    const avgVariance = (rVar + gVar + bVar) / 3;

    // Low variance = uniform color distribution (suspicious)
    if (avgVariance < totalPixels * 0.5) {
        score += 0.2;
    }

    // 5. Check for "perfect" color gradients
    // AI often creates too-smooth gradients
    let gradientSmoothness = 0;
    for (let i = 10; i < 246; i++) {
        // Check if histogram values are too consistent
        const window = [rHist[i - 1], rHist[i], rHist[i + 1]];
        const windowMean = window.reduce((a, b) => a + b, 0) / 3;
        const windowVar = window.reduce((sum, val) => sum + Math.pow(val - windowMean, 2), 0) / 3;

        if (windowVar < windowMean * 0.1 && windowMean > 10) {
            gradientSmoothness++;
        }
    }

    if (gradientSmoothness > 50) {
        score += 0.3; // Too many smooth gradient regions
    }

    // Create visualization (color histogram)
    const vizCanvas = document.createElement("canvas");
    vizCanvas.width = 256;
    vizCanvas.height = 150;
    const vizCtx = vizCanvas.getContext("2d");
    if (!vizCtx) throw new Error("No viz context");

    vizCtx.fillStyle = "#000";
    vizCtx.fillRect(0, 0, 256, 150);

    // Find max for scaling
    const maxR = Math.max(...rHist);
    const maxG = Math.max(...gHist);
    const maxB = Math.max(...bHist);
    const maxVal = Math.max(maxR, maxG, maxB);

    // Draw histograms
    for (let i = 0; i < 256; i++) {
        const rHeight = (rHist[i] / maxVal) * 140;
        const gHeight = (gHist[i] / maxVal) * 140;
        const bHeight = (bHist[i] / maxVal) * 140;

        vizCtx.fillStyle = "rgba(255, 0, 0, 0.5)";
        vizCtx.fillRect(i, 145 - rHeight, 1, rHeight);

        vizCtx.fillStyle = "rgba(0, 255, 0, 0.5)";
        vizCtx.fillRect(i, 145 - gHeight, 1, gHeight);

        vizCtx.fillStyle = "rgba(0, 0, 255, 0.5)";
        vizCtx.fillRect(i, 145 - bHeight, 1, bHeight);
    }

    return {
        score: Math.max(0, Math.min(1, score)),
        dataUrl: canvasToDataURL(vizCanvas.getContext("2d")!.getImageData(0, 0, 256, 150)),
        avgSaturation,
        clippingRatio,
    };
};
