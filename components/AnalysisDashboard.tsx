"use client";

import { useState } from "react";
import { AnalysisResult } from "../lib/types";
import { clsx } from "clsx";
import { CheckCircle, AlertTriangle, XCircle, Eye, Info } from "lucide-react";

interface AnalysisDashboardProps {
    result: AnalysisResult;
    onReset: () => void;
}

export function AnalysisDashboard({ result, onReset }: AnalysisDashboardProps) {
    const [activeTab, setActiveTab] = useState<"ela" | "fft" | "color" | "edge" | "noise" | "texture">("ela");

    const getScoreColor = (score: number) => {
        if (score < 0.4) return "text-green-500";
        if (score < 0.7) return "text-yellow-500";
        return "text-red-500";
    };

    const getScoreBg = (score: number) => {
        if (score < 0.4) return "bg-green-500";
        if (score < 0.7) return "bg-yellow-500";
        return "bg-red-500";
    };

    const tabs = [
        { id: "ela" as const, label: "ELA", description: "Error Level Analysis: Highlights compression artifacts. Uniform noise suggests AI." },
        { id: "fft" as const, label: "Frequency", description: "Frequency Analysis: Shows energy distribution. Grid patterns or high-freq anomalies suggest AI." },
        { id: "color" as const, label: "Color", description: "Color Analysis: Detects unnatural color distributions and saturation patterns in AI images." },
        { id: "edge" as const, label: "Edges", description: "Edge Detection: Identifies unnaturally sharp or smooth edges common in AI-generated content." },
        { id: "noise" as const, label: "Noise", description: "Noise Analysis: Real photos have sensor noise; AI images often lack it or have artificial patterns." },
        { id: "texture" as const, label: "Texture", description: "Texture Analysis: Detects repetitive patterns and overly smooth textures in AI images." },
    ];

    const getActiveVisualization = () => {
        switch (activeTab) {
            case "ela": return result.ela.dataUrl;
            case "fft": return result.fft.dataUrl;
            case "color": return result.color.dataUrl;
            case "edge": return result.edge.dataUrl;
            case "noise": return result.noise.dataUrl;
            case "texture": return result.texture.dataUrl;
        }
    };

    const getActiveScore = () => {
        switch (activeTab) {
            case "ela": return result.ela.score;
            case "fft": return result.fft.score;
            case "color": return result.color.score;
            case "edge": return result.edge.score;
            case "noise": return result.noise.score;
            case "texture": return result.texture.score;
        }
    };

    return (
        <div className="w-full max-w-6xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid gap-6 md:grid-cols-2">
                {/* Main Result Card */}
                <div className="col-span-2 p-6 rounded-2xl border bg-card/50 backdrop-blur-sm shadow-xl">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="space-y-2 text-center md:text-left">
                            <h2 className="text-2xl font-bold">Analysis Result</h2>
                            <div className="flex items-center gap-2 justify-center md:justify-start">
                                {result.verdict === "Likely Real" && <CheckCircle className="text-green-500 w-6 h-6" />}
                                {result.verdict === "Suspicious" && <AlertTriangle className="text-yellow-500 w-6 h-6" />}
                                {result.verdict === "Likely AI" && <XCircle className="text-red-500 w-6 h-6" />}
                                <span className={clsx("text-xl font-semibold", getScoreColor(result.overallScore))}>
                                    {result.verdict}
                                </span>
                            </div>
                            <div className="space-y-1">
                                <p className="text-muted-foreground text-sm">
                                    AI Score: {Math.round(result.overallScore * 100)}%
                                </p>
                                <p className="text-muted-foreground text-sm">
                                    Confidence: {Math.round(result.confidence * 100)}%
                                </p>
                            </div>
                        </div>

                        <div className="w-full md:w-1/3 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Real</span>
                                <span>AI</span>
                            </div>
                            <div className="h-4 w-full bg-secondary rounded-full overflow-hidden">
                                <div
                                    className={clsx("h-full transition-all duration-1000 ease-out", getScoreBg(result.overallScore))}
                                    style={{ width: `${result.overallScore * 100}%` }}
                                />
                            </div>
                        </div>

                        <button
                            onClick={onReset}
                            className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 transition-colors"
                        >
                            Analyze Another
                        </button>
                    </div>
                </div>

                {/* Module Scores Overview */}
                <div className="col-span-2 p-6 rounded-2xl border bg-card/50 backdrop-blur-sm shadow-lg space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                        <Info className="w-4 h-4" /> Detection Modules
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                        {[
                            { label: "Metadata", score: result.metadata.score },
                            { label: "ELA", score: result.ela.score },
                            { label: "FFT", score: result.fft.score },
                            { label: "Color", score: result.color.score },
                            { label: "Edges", score: result.edge.score },
                            { label: "Noise", score: result.noise.score },
                            { label: "Texture", score: result.texture.score },
                        ].map((module) => (
                            <div key={module.label} className="p-3 bg-secondary/50 rounded-lg text-center">
                                <div className="text-xs text-muted-foreground mb-1">{module.label}</div>
                                <div className={clsx("text-lg font-bold", getScoreColor(module.score))}>
                                    {Math.round(module.score * 100)}%
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Visualizations */}
                <div className="col-span-2 md:col-span-1 p-6 rounded-2xl border bg-card/50 backdrop-blur-sm shadow-lg space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold flex items-center gap-2">
                            <Eye className="w-4 h-4" /> Visual Analysis
                        </h3>
                    </div>

                    {/* Tab Buttons */}
                    <div className="grid grid-cols-3 gap-1 bg-secondary rounded-lg p-1">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={clsx(
                                    "px-2 py-1 text-xs font-medium rounded-md transition-all",
                                    activeTab === tab.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="aspect-square relative rounded-lg overflow-hidden border bg-black/50 flex items-center justify-center group">
                        <img
                            src={getActiveVisualization()}
                            alt="Analysis Visualization"
                            className="max-w-full max-h-full object-contain"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4 text-center">
                            <p className="text-white text-sm">
                                {tabs.find(t => t.id === activeTab)?.description}
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Score: {getActiveScore().toFixed(2)}</span>
                    </div>
                </div>

                {/* Metadata & Details */}
                <div className="col-span-2 md:col-span-1 p-6 rounded-2xl border bg-card/50 backdrop-blur-sm shadow-lg space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                        <Info className="w-4 h-4" /> Inspection Details
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <h4 className="text-sm font-medium text-muted-foreground mb-2">File Info</h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="p-2 bg-secondary/50 rounded">
                                    <span className="block text-xs text-muted-foreground">Dimensions</span>
                                    {result.dimensions.width} x {result.dimensions.height}
                                </div>
                                <div className="p-2 bg-secondary/50 rounded">
                                    <span className="block text-xs text-muted-foreground">Size</span>
                                    {(result.fileSize / 1024 / 1024).toFixed(2)} MB
                                </div>
                                <div className="p-2 bg-secondary/50 rounded col-span-2">
                                    <span className="block text-xs text-muted-foreground">Type</span>
                                    {result.mimeType}
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-medium text-muted-foreground mb-2">Metadata Analysis</h4>
                            {result.metadata.details.length > 0 ? (
                                <ul className="space-y-2 max-h-48 overflow-y-auto">
                                    {result.metadata.details.map((detail, i) => (
                                        <li key={i} className="text-sm flex items-start gap-2 p-2 rounded bg-secondary/30">
                                            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                                            {detail}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">No significant metadata findings.</p>
                            )}
                        </div>

                        <div>
                            <h4 className="text-sm font-medium text-muted-foreground mb-2">Additional Metrics</h4>
                            <div className="grid gap-2 text-xs">
                                <div className="p-2 bg-secondary/30 rounded">
                                    <span className="text-muted-foreground">Avg Saturation:</span> {Math.round(result.color.avgSaturation)}
                                </div>
                                <div className="p-2 bg-secondary/30 rounded">
                                    <span className="text-muted-foreground">Clipping Ratio:</span> {(result.color.clippingRatio * 100).toFixed(1)}%
                                </div>
                                <div className="p-2 bg-secondary/30 rounded">
                                    <span className="text-muted-foreground">Avg Edge:</span> {result.edge.avgEdgeStrength.toFixed(1)}
                                </div>
                                <div className="p-2 bg-secondary/30 rounded">
                                    <span className="text-muted-foreground">Noise Level:</span> {result.noise.avgNoise.toFixed(2)}
                                </div>
                                <div className="p-2 bg-secondary/30 rounded">
                                    <span className="text-muted-foreground">Texture Complexity:</span> {(result.texture.textureComplexity * 100).toFixed(1)}%
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
