import { GoogleGenAI, Type } from "@google/genai";

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: "No image provided" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured in Vercel environment variables" });
    }

    const cleanBase64 = image.includes(",") ? image.split(",")[1] : image;
    const mimeType = image.match(/^data:([^;]+);base64,/) ? image.match(/^data:([^;]+);base64,/)[1] : "image/jpeg";

    const response = await genAI.models.generateContent({
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
            text: "Extrae el número de serie (Serie, Lote), el producto y el tipo (medicinal o industrial) de esta etiqueta de cilindro de gas. Responde solo en JSON.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            serialNumber: { type: Type.STRING },
            product: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["medicinal", "industrial"] },
          },
          required: ["serialNumber", "product", "type"],
        },
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("No text returned from Gemini");
    }
    return res.json(JSON.parse(responseText));
  } catch (error: any) {
    console.error("Vercel Extraction Error:", error);
    return res.status(500).json({ error: error.message || "Failed to extract info" });
  }
}
