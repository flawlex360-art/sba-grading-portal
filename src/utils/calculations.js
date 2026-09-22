import { PROMOTION_THRESHOLD, CLASS_PROGRESSION } from '../constants/promotionMap';

/**
 * Generates ordinal suffixes for ranks (e.g. 1 -> 1st, 2 -> 2nd, etc.).
 */
export function getOrdinalSuffix(rank) {
  if (!rank) return '';
  const r = parseInt(rank, 10);
  if (isNaN(r)) return rank;
  if (r % 100 >= 11 && r % 100 <= 13) {
    return `${r}th`;
  }
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[r % 10] || 'th';
  return `${r}${suffix}`;
}

/**
 * Calculates letter grade and remark based on overall total out of 100.
 */
export function calculateGrade(total, config = { formula: 'default' }) {
  const t = parseFloat(total) || 0;
  if (t >= 90) return { grade: "1", remark: "Highest" };
  if (t >= 80) return { grade: "2", remark: "Higher" };
  if (t >= 70) return { grade: "3", remark: "High" };
  if (t >= 60) return { grade: "4", remark: "High Average" };
  if (t >= 55) return { grade: "5", remark: "Average" };
  if (t >= 50) return { grade: "6", remark: "Low Average" };
  if (t >= 40) return { grade: "7", remark: "Low" };
  if (t >= 35) return { grade: "8", remark: "Lower" };
  return { grade: "9", remark: "Lowest" };
}

/**
 * Centralized function to calculate a student's subject scores.
 * Computes SBA totals, exams scaling, overall totals, and grades.
 */
export function calculateStudentSubjectScores(gw1, test, gw2, proj, exams) {
  const pGw1 = parseFloat(gw1) || 0;
  const pTest = parseFloat(test) || 0;
  const pGw2 = parseFloat(gw2) || 0;
  const pProj = parseFloat(proj) || 0;
  const pExams = parseFloat(exams) || 0;

  const sbaTotal = pGw1 + pTest + pGw2 + pProj;
  const scaledSba = (sbaTotal / 100) * 50;
  const scaledExam = pExams * 0.5;
  const overallTotal = scaledSba + scaledExam;

  const { grade, remark } = calculateGrade(overallTotal);

  return {
    sbaTotal,
    scaledSba,
    scaledExam,
    overallTotal,
    grade,
    remark
  };
}

/**
 * Computes individual subject totals, grades, ranks, overall totals,
 * and overall ranks for the entire class, matching the Excel formulas.
 */
export function computeClassResults(students, gradesStore, subjects, subjectMap) {
  if (!students || students.length === 0) return [];

  // Initialize scores per student
  const studentScores = students.reduce((acc, s) => {
    acc[s.sn] = {
      sn: s.sn,
      name: s.name,
      gender: s.gender || "U",
      attendance: s.attendance || 0,
      conduct: s.conduct || "",
      interest: s.interest || "",
      remarks: s.remarks || "",
      promotedTo: s.promotedTo || "",
      subjects: {},
      overallTotal: 0
    };
    return acc;
  }, {});

  // Calculate scores per subject and compile lists for ranking
  subjects.forEach(subName => {
    const sheetKey = subjectMap[subName];
    const subGrades = gradesStore[sheetKey] || {};

    const subjectTotals = students.map(s => {
      const sg = subGrades[s.sn] || { gw1: 0, test: 0, gw2: 0, proj: 0, exams: 0 };
      
      const gw1 = sg.gw1;
      const test = sg.test;
      const gw2 = sg.gw2;
      const proj = sg.proj;
      const exams = sg.exams;

      const scores = calculateStudentSubjectScores(gw1, test, gw2, proj, exams);

      return {
        sn: s.sn,
        scaledSba: scores.scaledSba,
        scaledExam: scores.scaledExam,
        overallTotal: scores.overallTotal
      };
    });

    // Sort descending for ranking
    const sortedTotals = [...subjectTotals].sort((a, b) => b.overallTotal - a.overallTotal);

    // Compute ranks (handling ties with 5-decimal rounding)
    const ranks = {};
    sortedTotals.forEach((item, idx) => {
      const rankIdx = idx + 1;
      const roundedTotal = Math.round(item.overallTotal * 100000) / 100000;
      const prevRoundedTotal = idx > 0 ? Math.round(sortedTotals[idx - 1].overallTotal * 100000) / 100000 : 0;
      
      if (idx > 0 && roundedTotal === prevRoundedTotal) {
        ranks[item.sn] = ranks[sortedTotals[idx - 1].sn];
      } else {
        ranks[item.sn] = rankIdx;
      }
    });

    // Save details to studentScores
    subjectTotals.forEach(item => {
      const { grade, remark } = calculateGrade(item.overallTotal);
      studentScores[item.sn].subjects[subName] = {
        scaledSba: item.scaledSba,
        scaledExam: item.scaledExam,
        total: item.overallTotal,
        grade,
        remark,
        rank: getOrdinalSuffix(ranks[item.sn])
      };
      studentScores[item.sn].overallTotal += item.overallTotal;
    });
  });

  // Calculate overall class rankings
  const studentList = Object.values(studentScores);
  const sortedOverall = [...studentList].sort((a, b) => b.overallTotal - a.overallTotal);

  const overallRanks = {};
  sortedOverall.forEach((s, idx) => {
    const rankIdx = idx + 1;
    const roundedTotal = Math.round(s.overallTotal * 100000) / 100000;
    const prevRoundedTotal = idx > 0 ? Math.round(sortedOverall[idx - 1].overallTotal * 100000) / 100000 : 0;
    
    if (idx > 0 && roundedTotal === prevRoundedTotal) {
      overallRanks[s.sn] = overallRanks[sortedOverall[idx - 1].sn];
    } else {
      overallRanks[s.sn] = rankIdx;
    }
  });

  // Apply overall ranks
  studentList.forEach(s => {
    s.overallRank = getOrdinalSuffix(overallRanks[s.sn]);
    // Round for presentation (1 decimal place)
    s.overallTotal = Math.round(s.overallTotal * 10) / 10;
    
    // Round individual subject totals
    Object.keys(s.subjects).forEach(subName => {
      const sub = s.subjects[subName];
      sub.scaledSba = Math.round(sub.scaledSba * 10) / 10;
      sub.scaledExam = Math.round(sub.scaledExam * 10) / 10;
      sub.total = Math.round(sub.total * 10) / 10;
    });
  });

  // Return list sorted by S/N (matching Excel roster ordering)
  return studentList.sort((a, b) => a.sn - b.sn);
}

/**
 * Computes cumulative promotion recommendation across academic terms
 * with dynamic re-weighting for mid-year admissions.
 * Standard weights: Term 1 = 25% (0.25), Term 2 = 25% (0.25), Term 3 = 50% (0.50).
 * Mid-year dynamic re-weighting: Terms 2 & 3 = 33.3% (0.333) and 66.7% (0.667).
 */
export function computeCumulativePromotion(termData, currentStudents, subjects, subjectMap, classLevel) {
  if (!currentStudents || currentStudents.length === 0) return [];

  const terms = ['Term 1', 'Term 2', 'Term 3'];
  const termResults = {};

  terms.forEach(t => {
    if (termData && termData[t] && termData[t].students && termData[t].grades) {
      termResults[t] = computeClassResults(
        termData[t].students,
        termData[t].grades,
        subjects,
        subjectMap
      );
    } else {
      termResults[t] = [];
    }
  });

  return currentStudents.map(student => {
    const studentTerms = {};

    terms.forEach(t => {
      const found = termResults[t].find(s => s.sn === student.sn);
      if (found) {
        const numSubjects = subjects.length || 1;
        const termPercentage = found.overallTotal / numSubjects;
        const termGrades = termData?.[t]?.grades || {};
        const hasScores = Object.values(termGrades).some(sheet => {
          const g = sheet[student.sn];
          return g && (g.gw1 || g.test || g.gw2 || g.proj || g.exams);
        });

        if (hasScores || termResults[t].length > 0) {
          studentTerms[t] = termPercentage;
        }
      }
    });

    const availableTerms = Object.keys(studentTerms);
    let annualScore = 0;

    // Dynamic re-weighting based on available terms
    if (availableTerms.includes('Term 1') && availableTerms.includes('Term 2') && availableTerms.includes('Term 3')) {
      // Standard: 25% (0.25) Term 1, 25% (0.25) Term 2, 50% (0.50) Term 3
      annualScore = (0.25 * studentTerms['Term 1']) + (0.25 * studentTerms['Term 2']) + (0.50 * studentTerms['Term 3']);
    } else if (availableTerms.includes('Term 2') && availableTerms.includes('Term 3')) {
      // Mid-year admission in Term 2: 33.3% Term 2, 66.7% Term 3
      annualScore = (0.333 * studentTerms['Term 2']) + (0.667 * studentTerms['Term 3']);
    } else if (availableTerms.includes('Term 1') && availableTerms.includes('Term 3')) {
      // 33.3% Term 1, 66.7% Term 3
      annualScore = (0.333 * studentTerms['Term 1']) + (0.667 * studentTerms['Term 3']);
    } else if (availableTerms.includes('Term 1') && availableTerms.includes('Term 2')) {
      // 50% Term 1, 50% Term 2
      annualScore = (0.50 * studentTerms['Term 1']) + (0.50 * studentTerms['Term 2']);
    } else if (availableTerms.length === 1) {
      // Single term (e.g. admitted in Term 3 only): 100% weight
      annualScore = studentTerms[availableTerms[0]];
    } else {
      annualScore = 0;
    }

    annualScore = Math.round(annualScore * 10) / 10;
    const passed = annualScore >= PROMOTION_THRESHOLD;
    const nextClass = CLASS_PROGRESSION[classLevel] || CLASS_PROGRESSION[classLevel?.trim()] || 'the next class';
    const autoPromotedTo = passed
      ? `Promoted to ${nextClass}`
      : `To Repeat ${classLevel || 'current class'}`;

    return {
      sn: student.sn,
      annualScore,
      autoPromotedTo,
      passed
    };
  });
}

/**
 * Generates parent academic advisory note focusing on Mathematics and Science.
 */
export function generateParentAdvisory(studentName, mathScore, scienceScore) {
  const firstName = (studentName || 'Learner').trim().split(/\s+/)[0];
  const m = parseFloat(mathScore) || 0;
  const s = parseFloat(scienceScore) || 0;

  if (m < 50 && s < 50) {
    // Both < 50%: Double STEM Alert
    return `Special Academic Notice: While ${firstName} has shown effort this term, their performance in Mathematics (${m.toFixed(1)}%) and Integrated Science (${s.toFixed(1)}%) requires urgent attention.\n\nRecommended Practical Steps:\n1. Establish a daily 30-minute study period alternating between math exercises and science reading.\n2. Supervise completion of holiday assignments and practical exercises.\n3. Consider enrolling in remedial classes before the next term to strengthen foundational concepts.`;
  } else if (m < 50 && s >= 50) {
    // Maths < 50% only
    return `Subject Focus Notice (Mathematics): ${firstName} requires additional support in Mathematics (${m.toFixed(1)}%).\n\nRecommended Practical Steps:\nPlease assist with consistent practice in basic operations, word problems, and multiplication tables. Encourage them to solve at least 5 math problems daily at home.`;
  } else if (s < 50 && m >= 50) {
    // Science < 50% only
    return `Subject Focus Notice (Science): ${firstName} requires reinforcement in Integrated Science (${s.toFixed(1)}%).\n\nRecommended Practical Steps:\nAssist your ward in reading science textbooks and defining key terms. Encourage curiosity about natural phenomena and review class diagrams together.`;
  } else if (m >= 70 && s >= 70) {
    // Both >= 70%: Commendation
    return `Commendation: ${firstName} has demonstrated excellent aptitude in both Mathematics (${m.toFixed(1)}%) and Integrated Science (${s.toFixed(1)}%) this term! Continue encouraging this passion with STEM reading materials, educational puzzles, and science documentaries.`;
  } else {
    // Both >= 50% but < 70%: Satisfactory Performance
    return `${firstName}'s performance in Mathematics (${m.toFixed(1)}%) and Integrated Science (${s.toFixed(1)}%) is satisfactory this term. Continue encouraging consistent study habits, regular homework completion, and active participation in class to maintain and improve these results.`;
  }
}

