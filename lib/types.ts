export interface AnalysisResult {
    fileName: string;
    fileSize: number;
    dimensions: { width: number; height: number };
    mimeType: string;
    metadata: MetadataResult;
    ela: ELAResult;
    fft: FFTResult;
    overallScore: number; // 0 to 1 (1 = likely AI)
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
