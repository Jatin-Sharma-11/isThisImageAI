export interface AnalysisResult {
    fileName: string;
    fileSize: number;
    dimensions: { width: number; height: number };
    mimeType: string;
    metadata: MetadataResult;
    ela: ELAResult;
    fft: FFTResult;
    color: ColorAnalysisResult;
    edge: EdgeAnalysisResult;
    noise: NoiseAnalysisResult;
    texture: TextureAnalysisResult;
    overallScore: number; // 0 to 1 (1 = likely AI)
    confidence: number; // 0 to 1 (how confident we are in the verdict)
    verdict: "Likely Real" | "Suspicious" | "Likely AI";
}

export interface MetadataResult {
    score: number;
    details: string[];
    exifPresent: boolean;
    software?: string;
}

export interface ELAResult {
    score: number;
    dataUrl: string; // The ELA image visualization
}

export interface FFTResult {
    score: number;
    dataUrl: string; // The FFT spectrum visualization
}

export interface ColorAnalysisResult {
    score: number;
    dataUrl: string;
    avgSaturation: number;
    clippingRatio: number;
}

export interface EdgeAnalysisResult {
    score: number;
    dataUrl: string;
    avgEdgeStrength: number;
    edgeRatio: number;
}

export interface NoiseAnalysisResult {
    score: number;
    dataUrl: string;
    avgNoise: number;
    noiseConsistency: number;
}

export interface TextureAnalysisResult {
    score: number;
    dataUrl: string;
    textureComplexity: number;
    repetitionScore: number;
}
