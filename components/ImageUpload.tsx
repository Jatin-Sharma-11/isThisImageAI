"use client";

import { useState, useCallback } from "react";
import { Upload, FileImage, AlertCircle } from "lucide-react";
import { clsx } from "clsx";

interface ImageUploadProps {
    onImageSelect: (file: File) => void;
    isAnalyzing: boolean;
}

export function ImageUpload({ onImageSelect, isAnalyzing }: ImageUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);
            setError(null);

            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith("image/")) {
                onImageSelect(file);
            } else {
                setError("Please upload a valid image file (JPG, PNG, WEBP).");
            }
        },
        [onImageSelect]
    );

    const handleFileInput = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            setError(null);
            const file = e.target.files?.[0];
            if (file) {
                onImageSelect(file);
            }
        },
        [onImageSelect]
    );

    return (
        <div className="w-full max-w-2xl">
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById("file-upload")?.click()}
                className={clsx(
                    "relative border-2 border-dashed rounded-xl p-10 transition-all duration-200 ease-in-out cursor-pointer flex flex-col items-center justify-center gap-4 min-h-[300px]",
                    isDragging
                        ? "border-primary bg-primary/10 scale-[1.02]"
                        : "border-muted-foreground/25 bg-muted/5 hover:bg-muted/10",
                    isAnalyzing && "opacity-50 pointer-events-none animate-pulse"
                )}
            >
                <input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileInput}
                    disabled={isAnalyzing}
                />

                <div className={clsx("p-4 rounded-full transition-colors", isDragging ? "bg-primary/20" : "bg-muted/20")}>
                    {isAnalyzing ? (
                        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <Upload className={clsx("w-10 h-10", isDragging ? "text-primary" : "text-muted-foreground")} />
                    )}
                </div>

                <div className="space-y-2 text-center">
                    <p className="text-lg font-medium">
                        {isAnalyzing ? "Analyzing Image..." : "Drag and drop an image here"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {isAnalyzing ? "This runs locally on your device" : "or click to upload"}
                    </p>
                </div>

                {!isAnalyzing && (
                    <p className="text-xs text-muted-foreground mt-4">
                        Supports JPG, PNG, WEBP
                    </p>
                )}
            </div>

            {error && (
                <div className="mt-4 p-4 bg-destructive/10 text-destructive rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}
        </div>
    );
}
