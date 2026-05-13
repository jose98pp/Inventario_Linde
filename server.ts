import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '20mb' }));

  // API Route for Gemini Extraction
  app.post("/api/extract", async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) {
        return res.status(400).json({ error: "No image provided" });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured in the Secrets panel" });
      }

      const cleanBase64 = image.includes(",") ? image.split(",")[1] : image;
      const mimeType = image.match(/^data:([^;]+);base64,/) ? image.match(/^data:([^;]+);base64,/)[1] : "image/jpeg";

      const response = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [
          {
            role: "user",
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
        ],
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
      res.json(JSON.parse(responseText));
    } catch (error: any) {
      console.error("Server Extraction Error:", error);
      res.status(500).json({ error: error.message || "Failed to extract info" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
