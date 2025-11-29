import { EdgeAnalysisResult } from "../types";
import { canvasToDataURL } from "../utils";

export const analyzeEdges = async (img: HTMLImageElement): Promise<EdgeAnalysisResult> => {
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
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        gray[i / 4] = 0.299 * r + 0.587 * g + 0.114 * b;
    }

    // Sobel edge detection
    const sobelX = [
        [-1, 0, 1],
        [-2, 0, 2],
        [-1, 0, 1]
    ];
    const sobelY = [
        [-1, -2, -1],
        [0, 0, 0],
        [1, 2, 1]
    ];

    const edges = new Array(width * height).fill(0);
    const edgeAngles = new Array(width * height).fill(0);

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let gx = 0;
            let gy = 0;

            // Apply Sobel kernels
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const pixel = gray[(y + ky) * width + (x + kx)];
                    gx += pixel * sobelX[ky + 1][kx + 1];
                    gy += pixel * sobelY[ky + 1][kx + 1];
                }
            }

            const magnitude = Math.sqrt(gx * gx + gy * gy);
            const angle = Math.atan2(gy, gx);

            edges[y * width + x] = magnitude;
            edgeAngles[y * width + x] = angle;
        }
    }

    // Analyze edge characteristics
    let totalEdgeStrength = 0;
    let strongEdges = 0;
    let weakEdges = 0;
    const edgeThreshold = 50;
    const strongThreshold = 150;

    for (const edge of edges) {
        totalEdgeStrength += edge;
        if (edge > strongThreshold) strongEdges++;
        else if (edge > edgeThreshold) weakEdges++;
    }

    const avgEdgeStrength = totalEdgeStrength / edges.length;
    const edgePixels = strongEdges + weakEdges;
    const edgeRatio = edgePixels / edges.length;

    let score = 0;

    // 1. Check for unnaturally sharp edges
    // AI images often have very crisp, clean edges
    if (strongEdges > edges.length * 0.15) {
        score += 0.4; // Too many strong edges
    }

    // 2. Check for lack of edge variation
    // Real photos have edges of varying strength, AI can be too uniform
    const edgeVariance = edges.reduce((sum, val) => {
        const diff = val - avgEdgeStrength;
        return sum + diff * diff;
    }, 0) / edges.length;

    if (edgeVariance < 1000) {
        score += 0.3; // Too uniform edge strength
    }

    // 3. Check edge consistency
    // Measure local edge coherence (edges should follow natural structures)
    let coherentEdges = 0;
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            if (edges[idx] > edgeThreshold) {
                const angle = edgeAngles[idx];

                // Check neighbors
                let similarNeighbors = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        const nIdx = (y + dy) * width + (x + dx);
                        if (edges[nIdx] > edgeThreshold) {
                            const angleDiff = Math.abs(edgeAngles[nIdx] - angle);
                            if (angleDiff < 0.5 || angleDiff > Math.PI - 0.5) {
                                similarNeighbors++;
                            }
                        }
                    }
                }

                // AI edges are often TOO coherent
                if (similarNeighbors > 6) {
                    coherentEdges++;
                }
            }
        }
    }

    const coherenceRatio = edgePixels > 0 ? coherentEdges / edgePixels : 0;
    if (coherenceRatio > 0.6) {
        score += 0.3; // Edges are too coherent (unnatural)
    }

    // 4. Check for "plastic" smooth areas
    // AI images often have large areas with almost no edges
    let smoothRegions = 0;
    const regionSize = 20;

    for (let y = 0; y < height - regionSize; y += regionSize) {
        for (let x = 0; x < width - regionSize; x += regionSize) {
            let regionEdgeCount = 0;

            for (let ry = 0; ry < regionSize; ry++) {
                for (let rx = 0; rx < regionSize; rx++) {
                    if (edges[(y + ry) * width + (x + rx)] > edgeThreshold) {
                        regionEdgeCount++;
                    }
                }
            }

            // Too few edges in this region
            if (regionEdgeCount < 5) {
                smoothRegions++;
            }
        }
    }

    const totalRegions = Math.floor(width / regionSize) * Math.floor(height / regionSize);
    const smoothRatio = smoothRegions / totalRegions;

    if (smoothRatio > 0.4) {
        score += 0.3; // Too many overly smooth regions
    }

    // Create visualization
    const vizCanvas = document.createElement("canvas");
    vizCanvas.width = width;
    vizCanvas.height = height;
    const vizCtx = vizCanvas.getContext("2d");
    if (!vizCtx) throw new Error("No viz context");

    const vizData = vizCtx.createImageData(width, height);

    // Normalize edges for visualization
    const maxEdge = Math.max(...edges);
    for (let i = 0; i < edges.length; i++) {
        const val = (edges[i] / maxEdge) * 255;
        vizData.data[i * 4] = val;
        vizData.data[i * 4 + 1] = val;
        vizData.data[i * 4 + 2] = val;
        vizData.data[i * 4 + 3] = 255;
    }

    return {
        score: Math.max(0, Math.min(1, score)),
        dataUrl: canvasToDataURL(vizData),
        avgEdgeStrength,
        edgeRatio,
    };
};
