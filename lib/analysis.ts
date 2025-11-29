import { AnalysisResult } from "./types";
import { readImageFile } from "./utils";
import { analyzeMetadata } from "./modules/metadata";
import { analyzeELA } from "./modules/ela";
import { analyzeFFT } from "./modules/fft";
import { analyzeColor } from "./modules/color_analysis";
import { analyzeEdges } from "./modules/edge_detection";
import { analyzeNoise } from "./modules/noise_analysis";
import { analyzeTexture } from "./modules/texture_analysis";

export const analyzeImage = async (file: File): Promise<AnalysisResult> => {
    const img = await readImageFile(file);

    // Run all modules in parallel
    const [metadata, ela, fft, color, edge, noise, texture] = await Promise.all([
        analyzeMetadata(file),
        analyzeELA(img),
        analyzeFFT(img),
        analyzeColor(img),
        analyzeEdges(img),
        analyzeNoise(img),
        analyzeTexture(img),
    ]);

    // Advanced Weighted Scoring System
    // Different modules have different reliability - adjust weights accordingly

    // Base weights
    const weights = {
        metadata: 0.10,  // Weakest (can be stripped/faked)
        ela: 0.20,       // Strong for compression analysis
        fft: 0.15,       // Good for frequency artifacts
        color: 0.15,     // Detects unnatural color distributions
        edge: 0.15,      // Detects synthetic edges
        noise: 0.15,     // Detects lack of sensor noise
        texture: 0.10,   // Detects artificial textures
    };

    // Adaptive weighting based on individual scores
    // If a module has very high confidence (close to 0 or 1), increase its weight
    const scores = {
        metadata: metadata.score,
        ela: ela.score,
        fft: fft.score,
        color: color.score,
        edge: edge.score,
        noise: noise.score,
        texture: texture.score,
    };

    // Calculate confidence for each module (how decisive is the score?)
    const confidences: Record<string, number> = {};
    for (const [key, score] of Object.entries(scores)) {
        // Scores close to 0.5 are uncertain, close to 0 or 1 are confident
        confidences[key] = Math.abs(score - 0.5) * 2; // 0 = uncertain, 1 = very confident
    }

    // Adjust weights based on confidence
    const adjustedWeights = { ...weights };
    const totalConfidence = Object.values(confidences).reduce((a, b) => a + b, 0);

    if (totalConfidence > 0) {
        for (const key of Object.keys(weights) as Array<keyof typeof weights>) {
            // Boost weight for highly confident modules
            const confidenceBoost = confidences[key] * 0.5; // Up to 50% boost
            adjustedWeights[key] = weights[key] * (1 + confidenceBoost);
        }

        // Renormalize weights to sum to 1
        const totalWeight = Object.values(adjustedWeights).reduce((a, b) => a + b, 0);
        for (const key of Object.keys(adjustedWeights) as Array<keyof typeof adjustedWeights>) {
            adjustedWeights[key] /= totalWeight;
        }
    }

    // Calculate weighted score
    const overallScore =
        scores.metadata * adjustedWeights.metadata +
        scores.ela * adjustedWeights.ela +
        scores.fft * adjustedWeights.fft +
        scores.color * adjustedWeights.color +
        scores.edge * adjustedWeights.edge +
        scores.noise * adjustedWeights.noise +
        scores.texture * adjustedWeights.texture;

    // Calculate overall confidence
    // High confidence if multiple modules agree
    const agreement = Object.values(scores).filter(s =>
        Math.abs(s - overallScore) < 0.3
    ).length / Object.values(scores).length;

    const avgConfidence = Object.values(confidences).reduce((a, b) => a + b, 0) / Object.keys(confidences).length;
    const confidence = (agreement * 0.6 + avgConfidence * 0.4); // Combine agreement and individual confidence

    // Determine verdict with improved thresholds
    let verdict: AnalysisResult["verdict"] = "Likely Real";

    if (overallScore > 0.65) {
        verdict = "Likely AI";
    } else if (overallScore > 0.40) {
        verdict = "Suspicious";
    }

    // If confidence is very low, downgrade to "Suspicious" even with high score
    if (confidence < 0.3 && verdict === "Likely AI") {
        verdict = "Suspicious";
    }

    return {
        fileName: file.name,
        fileSize: file.size,
        dimensions: { width: img.width, height: img.height },
        mimeType: file.type,
        metadata,
        ela,
        fft,
        color,
        edge,
        noise,
        texture,
        overallScore,
        confidence,
        verdict,
    };
};
