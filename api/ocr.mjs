import { GoogleGenerativeAI } from "@google/generative-ai";

const ALLOWED_ORIGINS = [
  "https://bekku.xyz",
  "https://pain-in-the-bhat.github.io",
  "http://localhost:3000",
];

const SYSTEM_PROMPT = `You are a receipt OCR expert. Extract all bill items from the receipt image.

Rules:
- Return ONLY a valid JSON array
- Each item must have: "name" (string) and "price" (number in INR)
- Skip: tax, subtotal, total, grand total, tip, gst, cgst, sgst, igst, discount, round off, balance, payment method lines
- Skip any line that is clearly not a food/drink/item line
- Clean up item names - remove extra spaces, weird characters
- If price has a currency symbol, strip it and return just the number
- Prices should be numbers only, not strings
- If you see "₹350" return 350
- If you see "350.00" return 350
- Do NOT include any text before or after the JSON array
- Do NOT include markdown code fences
- Return an empty array [] if no items are found

Example output:
[{"name":"Margherita Pizza","price":350},{"name":"Garlic Bread","price":120},{"name":"Coke","price":80}]`;

export async function POST(req) {
  const origin = req.headers.get("origin") || "";
  const isAllowed = ALLOWED_ORIGINS.includes(origin);

  if (!isAllowed) {
    return new Response(
      JSON.stringify({ error: "Not allowed" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { image } = body;
  if (!image) {
    return new Response(
      JSON.stringify({ error: "No image provided" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Server misconfigured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const mimeType = image.match(/^data:(image\/\w+);/)?.[1] || "image/jpeg";

    const result = await model.generateContent([
      { inlineData: { data: base64Data, mimeType } },
      SYSTEM_PROMPT,
    ]);

    const response = await result.response;
    let text = response.text().trim();

    // Strip markdown code fences if present
    text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

    let items;
    try {
      items = JSON.parse(text);
    } catch {
      return new Response(
        JSON.stringify({ error: "Failed to parse OCR response", raw: text }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!Array.isArray(items)) {
      return new Response(
        JSON.stringify({ error: "Invalid response format", raw: text }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate and clean items
    const cleaned = items
      .filter((item) => item.name && item.price && typeof item.price === "number")
      .map((item) => ({
        name: String(item.name).trim(),
        price: Math.round(item.price * 100) / 100,
      }))
      .filter((item) => item.name.length > 0 && item.price > 0);

    return new Response(
      JSON.stringify({ items: cleaned }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": origin,
        },
      }
    );
  } catch (err) {
    console.error("OCR error:", err);
    return new Response(
      JSON.stringify({ error: "OCR processing failed" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": origin,
        },
      }
    );
  }
}

export async function OPTIONS(req) {
  const origin = req.headers.get("origin") || "";
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
