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
    const [activeTab, setActiveTab] = useState<"ela" | "fft">("ela");

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

    return (
        <div className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                            <p className="text-muted-foreground text-sm">
                                Confidence Score: {Math.round(result.overallScore * 100)}%
                            </p>
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

                {/* Visualizations */}
                <div className="p-6 rounded-2xl border bg-card/50 backdrop-blur-sm shadow-lg space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold flex items-center gap-2">
                            <Eye className="w-4 h-4" /> Visual Analysis
                        </h3>
                        <div className="flex bg-secondary rounded-lg p-1">
                            <button
                                onClick={() => setActiveTab("ela")}
                                className={clsx(
                                    "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                    activeTab === "ela" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                ELA
                            </button>
                            <button
                                onClick={() => setActiveTab("fft")}
                                className={clsx(
                                    "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                    activeTab === "fft" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                Frequency
                            </button>
                        </div>
                    </div>

                    <div className="aspect-square relative rounded-lg overflow-hidden border bg-black/50 flex items-center justify-center group">
                        <img
                            src={activeTab === "ela" ? result.ela.dataUrl : result.fft.dataUrl}
                            alt="Analysis Visualization"
                            className="max-w-full max-h-full object-contain"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4 text-center">
                            <p className="text-white text-sm">
                                {activeTab === "ela"
                                    ? "Error Level Analysis: Highlights compression artifacts. Uniform noise suggests AI/Resave."
                                    : "Frequency Analysis: Shows energy distribution. Grid patterns or high-freq anomalies suggest AI."}
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Score: {activeTab === "ela" ? result.ela.score.toFixed(2) : result.fft.score.toFixed(2)}</span>
                    </div>
                </div>

                {/* Metadata & Details */}
                <div className="p-6 rounded-2xl border bg-card/50 backdrop-blur-sm shadow-lg space-y-4">
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
                                <ul className="space-y-2">
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
                    </div>
                </div>
            </div>
        </div>
    );
}
