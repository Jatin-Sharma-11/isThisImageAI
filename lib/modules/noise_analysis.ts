import { NoiseAnalysisResult } from "../types";
import { canvasToDataURL } from "../utils";

export const analyzeNoise = async (img: HTMLImageElement): Promise<NoiseAnalysisResult> => {
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

    // Analyze high-frequency noise in flat regions
    // Real photos have sensor noise, AI images often lack it or have artificial patterns

    // 1. Find flat regions (low variance areas)
    const regionSize = 8;
    const flatRegions: Array<{ x: number, y: number, variance: number }> = [];

    for (let y = 0; y < height - regionSize; y += regionSize) {
        for (let x = 0; x < width - regionSize; x += regionSize) {
            let sumR = 0, sumG = 0, sumB = 0;
            let count = 0;

            // Calculate mean
            for (let ry = 0; ry < regionSize; ry++) {
                for (let rx = 0; rx < regionSize; rx++) {
                    const idx = ((y + ry) * width + (x + rx)) * 4;
                    sumR += data[idx];
                    sumG += data[idx + 1];
                    sumB += data[idx + 2];
                    count++;
                }
            }

            const meanR = sumR / count;
            const meanG = sumG / count;
            const meanB = sumB / count;

            // Calculate variance
            let varSum = 0;
            for (let ry = 0; ry < regionSize; ry++) {
                for (let rx = 0; rx < regionSize; rx++) {
                    const idx = ((y + ry) * width + (x + rx)) * 4;
                    const diffR = data[idx] - meanR;
                    const diffG = data[idx + 1] - meanG;
                    const diffB = data[idx + 2] - meanB;
                    varSum += diffR * diffR + diffG * diffG + diffB * diffB;
                }
            }

            const variance = varSum / count;

            // Flat regions have low variance
            if (variance < 100) {
                flatRegions.push({ x, y, variance });
            }
        }
    }

    let score = 0;

    // 2. Analyze noise in flat regions
    let totalNoise = 0;
    let noiseVariance = 0;
    const noiseSamples: number[] = [];

    for (const region of flatRegions.slice(0, 50)) { // Sample first 50 flat regions
        // Calculate pixel-to-pixel differences (high-freq noise)
        for (let ry = 0; ry < regionSize - 1; ry++) {
            for (let rx = 0; rx < regionSize - 1; rx++) {
                const idx1 = ((region.y + ry) * width + (region.x + rx)) * 4;
                const idx2 = ((region.y + ry) * width + (region.x + rx + 1)) * 4;
                const idx3 = ((region.y + ry + 1) * width + (region.x + rx)) * 4;

                const diff1 = Math.abs(data[idx1] - data[idx2]);
                const diff2 = Math.abs(data[idx1] - data[idx3]);
                const noise = (diff1 + diff2) / 2;

                noiseSamples.push(noise);
                totalNoise += noise;
            }
        }
    }

    const avgNoise = noiseSamples.length > 0 ? totalNoise / noiseSamples.length : 0;

    // Calculate noise variance
    if (noiseSamples.length > 0) {
        noiseVariance = noiseSamples.reduce((sum, val) => {
            const diff = val - avgNoise;
            return sum + diff * diff;
        }, 0) / noiseSamples.length;
    }

    // 3. Detect lack of natural noise
    // Real photos typically have noise level of 2-10 in flat regions
    // AI images are often too clean (< 1) or have artificial noise
    if (avgNoise < 1.5) {
        score += 0.5; // Too clean (no sensor noise)
    } else if (avgNoise > 15) {
        score += 0.2; // Too noisy (might be added artificially)
    }

    // 4. Check noise consistency
    // Real sensor noise is relatively consistent across flat regions
    // Artificial noise can have unnatural patterns
    const noiseStdDev = Math.sqrt(noiseVariance);
    const coefficientOfVariation = avgNoise > 0 ? noiseStdDev / avgNoise : 0;

    // Too consistent = artificial, too varied = also suspicious
    if (coefficientOfVariation < 0.3) {
        score += 0.3; // Noise is too uniform (artificial pattern)
    } else if (coefficientOfVariation > 2.0) {
        score += 0.2; // Noise varies too much
    }

    // 5. Detect periodic noise patterns (common in GANs)
    // Check for repeating patterns in noise
    let periodicPatterns = 0;
    const patternSize = 4;

    for (let i = 0; i < noiseSamples.length - patternSize * 2; i++) {
        const pattern1 = noiseSamples.slice(i, i + patternSize);
        const pattern2 = noiseSamples.slice(i + patternSize, i + patternSize * 2);

        // Compare patterns
        let similarity = 0;
        for (let j = 0; j < patternSize; j++) {
            const diff = Math.abs(pattern1[j] - pattern2[j]);
            if (diff < 2) similarity++;
        }

        if (similarity >= patternSize - 1) {
            periodicPatterns++;
        }
    }

    if (periodicPatterns > noiseSamples.length * 0.1) {
        score += 0.4; // Detected periodic patterns
    }

    // 6. Check for "too perfect" flat regions
    const tooFlatRegions = flatRegions.filter(r => r.variance < 5).length;
    const tooFlatRatio = flatRegions.length > 0 ? tooFlatRegions / flatRegions.length : 0;

    if (tooFlatRatio > 0.3) {
        score += 0.3; // Too many perfectly flat regions
    }

    // Create visualization (noise map)
    const vizCanvas = document.createElement("canvas");
    vizCanvas.width = width;
    vizCanvas.height = height;
    const vizCtx = vizCanvas.getContext("2d");
    if (!vizCtx) throw new Error("No viz context");

    const vizData = vizCtx.createImageData(width, height);

    // Compute high-pass filter (emphasizes noise)
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;

            // Laplacian filter (edge/noise detection)
            let sumR = 0, sumG = 0, sumB = 0;

            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const nIdx = ((y + dy) * width + (x + dx)) * 4;
                    const weight = (dx === 0 && dy === 0) ? -8 : 1;
                    sumR += data[nIdx] * weight;
                    sumG += data[nIdx + 1] * weight;
                    sumB += data[nIdx + 2] * weight;
                }
            }

            // Amplify for visualization
            const amplify = 5;
            vizData.data[idx] = Math.abs(sumR) * amplify;
            vizData.data[idx + 1] = Math.abs(sumG) * amplify;
            vizData.data[idx + 2] = Math.abs(sumB) * amplify;
            vizData.data[idx + 3] = 255;
        }
    }

    return {
        score: Math.max(0, Math.min(1, score)),
        dataUrl: canvasToDataURL(vizData),
        avgNoise,
        noiseConsistency: 1 - coefficientOfVariation,
    };
};
