import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || '' 
});

export interface ExtractionResult {
  serialNumber: string;
  product: string;
  type: 'medicinal' | 'industrial' | null;
}

export const extractCylinderInfo = async (base64Image: string): Promise<ExtractionResult | null> => {
  try {
    // Detect actual MIME type
    const mimeMatch = base64Image.match(/^data:([^;]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
    
    // Remove data URL prefix
    const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: cleanBase64,
            },
          },
          {
            text: `Extract information from this gas cylinder label. 
            Identifica el número de serie (Serie, Lote), el nombre del producto (Oxigeno, Nitrogeno, etc) y si es tipo MEDICINAL o INDUSTRIAL.
            
            Return a JSON object:
            {
              "serialNumber": "string",
              "product": "string",
              "type": "medicinal" | "industrial"
            }`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            serialNumber: { type: Type.STRING, description: "Cylinder serial number or batch number" },
            product: { type: Type.STRING, description: "Gas product name" },
            type: { type: Type.STRING, enum: ["medicinal", "industrial"], description: "Use type" },
          },
          required: ["serialNumber", "product", "type"],
        },
      },
    });

    if (response && response.text) {
      return JSON.parse(response.text.trim());
    }
    return null;
  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    return null;
  }
};
