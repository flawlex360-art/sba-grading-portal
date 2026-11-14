import { resolveSchoolLevel, SCHOOL_LEVELS } from '../constants/curriculum';

export async function generateClassSummary(analytics, rankedResults, apiKey, metadata = {}) {
  if (!apiKey) {
    throw new Error("Gemini API Key is missing. Please set VITE_GEMINI_API_KEY in your environment variables.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

  const isKg =
    resolveSchoolLevel(metadata?.classLevel, metadata?.level) === SCHOOL_LEVELS.KG ||
    rankedResults?.some((s) => s?.isKgResult);

  let prompt = '';

  if (isKg) {
    const needSupportLearners = rankedResults.filter((s) => (s.masteryCounts?.NYS || 0) > 0);
    const supportNames = needSupportLearners.slice(0, 5).map((s) => s.name).join(', ') +
      (needSupportLearners.length > 5 ? ` and ${needSupportLearners.length - 5} more` : '');
    const consistentCount = rankedResults.filter(
      (s) => (s.masteryCounts?.IND || 0) > 0 && (s.masteryCounts?.NYS || 0) === 0
    ).length;

    prompt = `You are an experienced Early Childhood / Kindergarten Headteacher analyzing end-of-term developmental observation records under the Ghana NaCCA Kindergarten Curriculum (4 Learning Areas: Language & Literacy, Numeracy, Our World & Our People, and Creativity, rated IND = Independently, DEV = Developing, EMG = Emerging, NYS = Not Yet / Needs Support). Do NOT use exam percentages, class rankings, or failing/repeat terminology.

Here is the class overview:
- Class Level: ${metadata.classLevel || 'Kindergarten'}
- Learners Enrolled: ${rankedResults.length}
- Overall Mastery Index: ${analytics.classAverage}%
- On-Track Rate (Developing / Independent): ${analytics.passRate}%
- Strongest Learning Area: ${analytics.bestSubject.name} (${parseFloat(analytics.bestSubject.avg).toFixed(1)}%)
- Focus Learning Area Needing Play-Based Scaffolding: ${analytics.worstSubject.name} (${parseFloat(analytics.worstSubject.avg).toFixed(1)}%)
- Learners Demonstrating Consistent Independence: ${consistentCount}
- Learners Needing Early Support (any NYS rating): ${needSupportLearners.length > 0 ? supportNames : 'None'}

Start the report with a bold title:
# ${metadata.classLevel || 'Kindergarten'} Developmental Progress Review — ${metadata.term || 'Term'}, ${metadata.academicYear || ''}
**Facilitator / Teacher:** ${metadata.teacherName || 'N/A'}

Include the following Markdown sections:
### 📊 Developmental Overview
Summarize overall play-based learning growth across the 4 learning areas and social-emotional readiness.

### 🌱 Areas for Play-Based Reinforcement
Discuss the focus learning area (${analytics.worstSubject.name}) and developmentally appropriate classroom activities to support emerging learners without punitive testing.

### 🤝 Early Intervention & Parent Partnership
Recommend warm, practical classroom differentiation and simple home activities (storytelling, counting objects, drawing/crafting, shared chores) for the next term.`;
  } else {
    // Format top 3 students
    const top3 = rankedResults.slice(0, 3).map(s => `${s.name} (${s.overallTotal} total, ${s.overallRank})`).join(", ");
    
    // Format at-risk students (overall avg < 40%)
    const subjectCount = Object.keys(rankedResults[0]?.subjects || {}).length || 9; 
    const atRiskStudents = rankedResults.filter(s => (s.overallTotal / subjectCount) < 40);
    const atRiskCount = atRiskStudents.length;
    const atRiskNames = atRiskStudents.slice(0, 3).map(s => s.name).join(", ") + (atRiskCount > 3 ? ` and ${atRiskCount - 3} more` : "");

    prompt = `You are an expert Headteacher analyzing a class's end-of-term results. 
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
  }

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
