export async function generateClassSummary(analytics, rankedResults, apiKey, metadata = {}) {
  if (!apiKey) {
    throw new Error("Gemini API Key is missing. Please set VITE_GEMINI_API_KEY in your environment variables.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
  
  // Format top 3 students
  const top3 = rankedResults.slice(0, 3).map(s => `${s.name} (${s.overallTotal} total, ${s.overallRank})`).join(", ");
  
  // Format at-risk students (overall avg < 40%)
  // Try to estimate subject count, fallback to 10
  const subjectCount = 10; 
  const atRiskStudents = rankedResults.filter(s => (s.overallTotal / subjectCount) < 40);
  const atRiskCount = atRiskStudents.length;
  const atRiskNames = atRiskStudents.slice(0, 3).map(s => s.name).join(", ") + (atRiskCount > 3 ? ` and ${atRiskCount - 3} more` : "");

  const prompt = `You are an expert Headteacher analyzing a class's end-of-term results. 
Here is the data:
- Class Average: ${analytics.classAverage}%
- Pass Rate: ${analytics.passRate}%
- Top Subject: ${analytics.bestSubject.name} (${parseFloat(analytics.bestSubject.avg).toFixed(1)}% avg)
- Lowest Subject: ${analytics.worstSubject.name} (${parseFloat(analytics.worstSubject.avg).toFixed(1)}% avg)
- Boys Average: ${analytics.boyAvg !== '-' ? analytics.boyAvg + '%' : 'N/A'}
- Girls Average: ${analytics.girlAvg !== '-' ? analytics.girlAvg + '%' : 'N/A'}
- Top 3 Students: ${top3 || "N/A"}
- At-Risk Students (avg < 40%): ${atRiskCount > 0 ? atRiskNames : "None"}

Write a highly detailed, diagnostic performance review.
Start the report with a bold title:
# ${metadata.classLevel || 'Class'} Performance Review — ${metadata.term || 'Term'}, ${metadata.academicYear || ''}
**Class Teacher:** ${metadata.teacherName || 'N/A'}

Then continue with the following sections.
Format the output in **Markdown** using headings, bullet points, and bold text for emphasis.
Include the following sections:
### 📊 Executive Summary
A high-level overview highlighting strengths (class average, pass rate, top subjects, demographic strengths).

### 🔍 Diagnostic Areas of Concern
Deep dive into lowest subjects, underperforming demographics, and specific at-risk students. Provide actionable, pedagogical insights on why these issues might be occurring.

### 📈 Strategic Recommendations
Targeted, actionable recommendations for the next term to improve overall performance and help struggling students.

Keep the tone professional, encouraging, and highly analytical. Ensure your response is comprehensive and complete.`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 3000,
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

  return text.trim();
}
