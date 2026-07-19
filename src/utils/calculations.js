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
export function calculateGrade(total) {
  const t = parseFloat(total) || 0;
  if (t > 79) return { grade: "HP", remark: "HIGHLY PROFICIENT" };
  if (t > 67) return { grade: "P", remark: "PROFICIENT" };
  if (t > 53) return { grade: "AP", remark: "APPROACHING PROFICIENCY" };
  if (t > 39) return { grade: "D", remark: "DEVELOPING" };
  return { grade: "E", remark: "EMERGING" };
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
      
      const gw1 = parseFloat(sg.gw1) || 0;
      const test = parseFloat(sg.test) || 0;
      const gw2 = parseFloat(sg.gw2) || 0;
      const proj = parseFloat(sg.proj) || 0;
      const exams = parseFloat(sg.exams) || 0;

      const sbaTotal = gw1 + test + gw2 + proj;
      const scaledSba = (sbaTotal / 60) * 50;
      const scaledExam = exams * 0.5;
      const overallTotal = scaledSba + scaledExam;

      return {
        sn: s.sn,
        scaledSba,
        scaledExam,
        overallTotal
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
