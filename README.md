# billi-ocr

Vercel serverless function proxy for Billi's receipt OCR. Forwards images to Google Gemini 2.0 Flash and returns extracted items as JSON.

## Deploy

1. Push to GitHub
2. Import in Vercel
3. Set `GEMINI_API_KEY` in Vercel env vars
4. Deploy

## API

`POST /api/ocr`

**Request:**
```json
{ "image": "data:image/jpeg;base64,..." }
```

**Response:**
```json
{ "items": [{ "name": "Margherita Pizza", "price": 350 }] }
```
