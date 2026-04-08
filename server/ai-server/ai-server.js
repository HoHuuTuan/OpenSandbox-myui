import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";

const app = express();
app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.post("/generate-python", async (req, res) => {
  try {
    const { prompt } = req.body;

    const systemPrompt = `
Bạn là trợ lý viết code Python cho sandbox.
Chỉ trả về code Python thuần.
Không dùng markdown.
Không dùng dấu \`\`\`.
Nếu cần vẽ biểu đồ, hãy print ra JSON theo format:
{
  "type": "chart",
  "chart": "line" | "bar" | "pie",
  "title": "...",
  "x": [...],
  "series": [
    {"name": "...", "data": [...]}
  ]
}
Nếu cần trả bảng, hãy gán result = dataframe.
Nếu cần trả ảnh, hãy in JSON image_base64.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\n\nUser request:\n${prompt}` }],
        },
      ],
    });

    const code = (response.text || "").trim();
    res.json({ code });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.listen(3001, () => {
  console.log("Gemini AI server running on http://localhost:3001");
});