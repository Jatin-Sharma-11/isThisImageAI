"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { ImageUpload } from "@/components/ImageUpload";
import { AnalysisDashboard } from "@/components/AnalysisDashboard";
import { analyzeImage } from "@/lib/analysis";
import { AnalysisResult } from "@/lib/types";

export default function Home() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleImageSelect = async (file: File) => {
    setIsAnalyzing(true);
    try {
      // Small delay to allow UI to update and show loading state
      await new Promise(resolve => setTimeout(resolve, 500));
      const analysisResult = await analyzeImage(file);
      setResult(analysisResult);
    } catch (error) {
      console.error("Analysis failed:", error);
      alert("Failed to analyze image. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setResult(null);
  };

  return (
    <div className="container relative max-w-screen-2xl flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] py-10">
      <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>

      {!result ? (
        <>
          <div className="space-y-4 mb-10 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
              Is This Image AI?
            </h1>
            <p className="text-xl text-muted-foreground max-w-[600px] mx-auto">
              Analyze images directly in your browser. No backend, no data uploads.
              Detect metadata anomalies, compression artifacts, and frequency patterns.
            </p>
          </div>

          <ImageUpload onImageSelect={handleImageSelect} isAnalyzing={isAnalyzing} />
        </>
      ) : (
        <AnalysisDashboard result={result} onReset={handleReset} />
      )}
    </div>
  );
}

