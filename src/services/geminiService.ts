export interface ExtractionResult {
  serialNumber: string;
  product: string;
  type: 'medicinal' | 'industrial' | null;
}

export const extractCylinderInfo = async (base64Image: string): Promise<ExtractionResult | null> => {
  try {
    const response = await fetch("/api/extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image: base64Image }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to extract info");
    }

    return await response.json();
  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    return null;
  }
};
