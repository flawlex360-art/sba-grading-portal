export async function transcribeSheetImage(base64Image, mimeType, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  const prompt = `You are an expert grading OCR assistant. Extract student grades from this handwritten or printed SBA grading sheet.
  Return a structured JSON array of student rows. 
  For each row, extract:
  - "sn": The serial number (integer) if present, or null.
  - "name": The student's name (string).
  - "gw1": Group Work 1 score (number or null if empty).
  - "test": Class Test 1 score (number or null if empty).
  - "gw2": Group Work 2 score (number or null if empty).
  - "proj": Project score (number or null if empty).
  - "exams": Examination score (number or null if empty).

  Match column headers accurately. Standard SBA columns are usually marked: Group Work, Class Test, Project, Homework, Exams, etc.
  Return ONLY the JSON array inside a root key named "records". Example:
  {
    "records": [
      { "sn": 1, "name": "Kofi Mensah", "gw1": 8, "test": 9, "gw2": 7, "proj": 15, "exams": 72 }
    ]
  }`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: base64Image
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API Error: ${errText || response.statusText}`);
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Invalid or empty response from Gemini AI.");
  }

  const parsed = JSON.parse(text);
  return parsed.records || [];
}
