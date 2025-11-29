import { AnalysisResult } from "./types";
import { readImageFile } from "./utils";
import { analyzeMetadata } from "./modules/metadata";
import { analyzeELA } from "./modules/ela";
import { analyzeFFT } from "./modules/fft";

export const analyzeImage = async (file: File): Promise<AnalysisResult> => {
    const img = await readImageFile(file);

    // Run modules in parallel
    const [metadata, ela, fft] = await Promise.all([
        analyzeMetadata(file),
        analyzeELA(img),
        analyzeFFT(img),
    ]);

    // Calculate overall score
    // Weighted average
    // ELA is often the strongest indicator for "clean" AI images vs noisy real photos.
    const w1 = 0.2; // Metadata (Weak signal)
    const w2 = 0.5; // ELA (Strong signal for consistency/noise)
    const w3 = 0.3; // FFT (Medium signal for artifacts)

    const overallScore = (metadata.score * w1) + (ela.score * w2) + (fft.score * w3);

    let verdict: AnalysisResult["verdict"] = "Likely Real";
    // Lower threshold to catch more AI images (reduce false negatives)
    if (overallScore > 0.55) verdict = "Likely AI";
    else if (overallScore > 0.35) verdict = "Suspicious";

    return {
        fileName: file.name,
        fileSize: file.size,
        dimensions: { width: img.width, height: img.height },
        mimeType: file.type,
        metadata,
        ela,
        fft,
        overallScore,
        verdict,
    };
};
