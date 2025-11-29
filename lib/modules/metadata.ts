import EXIF from "exif-js";
import { MetadataResult } from "../types";

export const analyzeMetadata = (file: File): Promise<MetadataResult> => {
    return new Promise((resolve) => {
        // @ts-ignore - exif-js types are sometimes tricky
        EXIF.getData(file as any, function (this: any) {
            const allTags = EXIF.getAllTags(this);
            const details: string[] = [];
            let score = 0;
            let exifPresent = false;
            let software = "";

            if (Object.keys(allTags).length > 0) {
                exifPresent = true;

                // Check for Software tag
                if (allTags.Software) {
                    software = allTags.Software;
                    details.push(`Software detected: ${software}`);

                    // Known AI generators or editing tools
                    const suspiciousSoftware = ["Adobe Photoshop", "GIMP", "Stable Diffusion", "Midjourney"];
                    if (suspiciousSoftware.some(s => software.includes(s))) {
                        score += 0.4;
                        details.push("Suspicious software signature found.");
                    }
                } else {
                    // AI images often lack Software tags or have very minimal metadata
                    details.push("No Software tag found.");
                }

                // Check for UserComment (sometimes contains generation parameters)
                if (allTags.UserComment) {
                    // Convert char codes to string if needed, or handle string
                    const comment = allTags.UserComment.toString();
                    if (comment.includes("steps:") || comment.includes("seed:") || comment.includes("cfg:")) {
                        score += 0.8;
                        details.push("Generation parameters found in UserComment.");
                    }
                }

            } else {
                // No EXIF data is suspicious for a "photo", but common for web images
                details.push("No EXIF metadata found.");
                // INCREASED PENALTY: Real original photos almost always have EXIF.
                // AI images (direct from generation) usually don't.
                score += 0.3;
            }

            // Check Dimensions (Common AI Resolutions)
            const width = (this as any).width || 0;
            const height = (this as any).height || 0;

            // Common AI base resolutions
            const aiResolutions = [
                [512, 512], [1024, 1024], [512, 768], [768, 512],
                [1024, 1792], [1792, 1024]
            ];

            // Check for exact match or simple multiples
            const isSuspiciousRes = aiResolutions.some(([w, h]) =>
                (width === w && height === h) ||
                (width === w * 2 && height === h * 2)
            );

            if (isSuspiciousRes) {
                score += 0.2;
                details.push(`Suspicious resolution detected (${width}x${height}).`);
            }

            // Check for perfect squares (common in older models)
            if (width === height && width > 256) {
                score += 0.1;
                details.push("Square aspect ratio (common in AI).");
            }

            resolve({
                score: Math.min(score, 1),
                details,
                exifPresent,
                software
            });
        });
    });
};
