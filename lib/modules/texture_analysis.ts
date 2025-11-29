import { TextureAnalysisResult } from "../types";
import { canvasToDataURL } from "../utils";

export const analyzeTexture = async (img: HTMLImageElement): Promise<TextureAnalysisResult> => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No context");

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    // Convert to grayscale
    const gray = new Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
        gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    // Local Binary Pattern (LBP) Analysis
    // LBP captures texture patterns, AI textures often have unnatural patterns
    const lbp = new Array(width * height).fill(0);
    const lbpHistogram = new Array(256).fill(0);

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const center = gray[y * width + x];
            let pattern = 0;

            // 8 neighbors in clockwise order
            const neighbors = [
                gray[(y - 1) * width + (x - 1)], // top-left
                gray[(y - 1) * width + x],       // top
                gray[(y - 1) * width + (x + 1)], // top-right
                gray[y * width + (x + 1)],       // right
                gray[(y + 1) * width + (x + 1)], // bottom-right
                gray[(y + 1) * width + x],       // bottom
                gray[(y + 1) * width + (x - 1)], // bottom-left
                gray[y * width + (x - 1)]        // left
            ];

            // Create binary pattern
            for (let i = 0; i < 8; i++) {
                if (neighbors[i] >= center) {
                    pattern |= (1 << i);
                }
            }

            lbp[y * width + x] = pattern;
            lbpHistogram[pattern]++;
        }
    }

    let score = 0;

    // 1. Analyze LBP histogram
    // Natural textures have varied patterns, AI can be too uniform or have specific patterns
    const totalLBP = lbpHistogram.reduce((a, b) => a + b, 0);
    const nonZeroPatterns = lbpHistogram.filter(v => v > 0).length;

    // Too few distinct patterns = artificial texture
    if (nonZeroPatterns < 80) {
        score += 0.4; // Not enough texture variety
    }

    // 2. Check for dominant patterns
    const maxPatternCount = Math.max(...lbpHistogram);
    const dominanceRatio = maxPatternCount / totalLBP;

    if (dominanceRatio > 0.3) {
        score += 0.3; // One pattern dominates too much
    }

    // 3. Detect repetitive patterns
    // AI sometimes creates repeating texture tiles
    const blockSize = 32;
    let repetitiveBlocks = 0;
    const blockPatterns: Array<{ histogram: number[], x: number, y: number }> = [];

    for (let by = 0; by < height - blockSize; by += blockSize) {
        for (let bx = 0; bx < width - blockSize; bx += blockSize) {
            const blockHist = new Array(256).fill(0);

            for (let y = by; y < by + blockSize && y < height; y++) {
                for (let x = bx; x < bx + blockSize && x < width; x++) {
                    blockHist[lbp[y * width + x]]++;
                }
            }

            blockPatterns.push({ histogram: blockHist, x: bx, y: by });
        }
    }

    // Compare blocks for similarity
    for (let i = 0; i < blockPatterns.length; i++) {
        for (let j = i + 1; j < blockPatterns.length; j++) {
            // Skip adjacent blocks
            const dx = Math.abs(blockPatterns[i].x - blockPatterns[j].x);
            const dy = Math.abs(blockPatterns[i].y - blockPatterns[j].y);
            if (dx <= blockSize && dy <= blockSize) continue;

            // Compare histograms using correlation
            let similarity = 0;
            for (let k = 0; k < 256; k++) {
                const v1 = blockPatterns[i].histogram[k];
                const v2 = blockPatterns[j].histogram[k];
                similarity += Math.min(v1, v2);
            }

            const totalCount = blockSize * blockSize;
            if (similarity > totalCount * 0.8) {
                repetitiveBlocks++;
            }
        }
    }

    const repetitionRatio = blockPatterns.length > 0 ?
        repetitiveBlocks / (blockPatterns.length * (blockPatterns.length - 1) / 2) : 0;

    if (repetitionRatio > 0.05) {
        score += 0.4; // Detected repeating patterns
    }

    // 4. Check for "plastic" or overly smooth textures
    // Calculate local texture variance
    let lowVarianceRegions = 0;
    const testRegionSize = 16;

    for (let y = 0; y < height - testRegionSize; y += testRegionSize) {
        for (let x = 0; x < width - testRegionSize; x += testRegionSize) {
            let regionVariance = 0;
            const regionPatterns: number[] = [];

            for (let ry = 0; ry < testRegionSize; ry++) {
                for (let rx = 0; rx < testRegionSize; rx++) {
                    regionPatterns.push(lbp[(y + ry) * width + (x + rx)]);
                }
            }

            const mean = regionPatterns.reduce((a, b) => a + b, 0) / regionPatterns.length;
            regionVariance = regionPatterns.reduce((sum, val) =>
                sum + Math.pow(val - mean, 2), 0) / regionPatterns.length;

            // Very low variance = smooth/plastic texture
            if (regionVariance < 500) {
                lowVarianceRegions++;
            }
        }
    }

    const totalTestRegions = Math.floor(width / testRegionSize) * Math.floor(height / testRegionSize);
    const smoothRatio = lowVarianceRegions / totalTestRegions;

    if (smoothRatio > 0.4) {
        score += 0.3; // Too many smooth regions
    }

    // 5. Detect uniform patterns (common in AI-generated backgrounds)
    // Check entropy of LBP histogram
    let entropy = 0;
    for (const count of lbpHistogram) {
        if (count > 0) {
            const p = count / totalLBP;
            entropy -= p * Math.log2(p);
        }
    }

    // Natural textures have high entropy, AI can have lower
    const maxEntropy = Math.log2(256);
    const normalizedEntropy = entropy / maxEntropy;

    if (normalizedEntropy < 0.4) {
        score += 0.3; // Low texture complexity
    }

    // Create visualization (LBP texture map)
    const vizCanvas = document.createElement("canvas");
    vizCanvas.width = width;
    vizCanvas.height = height;
    const vizCtx = vizCanvas.getContext("2d");
    if (!vizCtx) throw new Error("No viz context");

    const vizData = vizCtx.createImageData(width, height);

    for (let i = 0; i < lbp.length; i++) {
        const val = lbp[i];
        vizData.data[i * 4] = val;
        vizData.data[i * 4 + 1] = val;
        vizData.data[i * 4 + 2] = val;
        vizData.data[i * 4 + 3] = 255;
    }

    return {
        score: Math.max(0, Math.min(1, score)),
        dataUrl: canvasToDataURL(vizData),
        textureComplexity: normalizedEntropy,
        repetitionScore: repetitionRatio,
    };
};
