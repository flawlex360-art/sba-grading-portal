import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
  SCHOOL_LEVELS,
  deriveKgAreaRatingFromIndicators,
  getKgProficiencyMeta,
  normalizeKgRatingCode,
  resolveSchoolLevel,
} from '../constants/curriculum.js';

export const exportYearlyData = async (termData, metadata, teacherSubjects) => {
  const wb = new ExcelJS.Workbook();

  // Create a sheet for each term
  ["Term 1", "Term 2", "Term 3"].forEach(termName => {
    const term = termData[termName];
    if (!term || !term.students || term.students.length === 0) return;

    const students = term.students;
    const grades = term.grades || {};

    const isKgSheet =
      resolveSchoolLevel(metadata?.classLevel, metadata?.level) === SCHOOL_LEVELS.KG ||
      teacherSubjects.some((sub) => {
        const areaGrades = grades[sub.key] || grades[sub.name] || {};
        return Object.values(areaGrades).some((g) => g && g.mode === 'kg');
      });

    const ws = wb.addWorksheet(termName);

    // Header Rows
    const header1 = ["", ""];
    const header2 = ["S/N", "Name"];

    if (isKgSheet) {
      teacherSubjects.forEach((sub) => {
        header1.push(sub.name, "", "");
        header2.push("Proficiency", "Milestones (IND)", "Facilitator Note");
      });
    } else {
      teacherSubjects.forEach(sub => {
        header1.push(sub.name, "", "", "", "", ""); // Merge space
        header2.push("Test 1", "Group Work", "Test 2", "Project", "Exams", "Total");
      });
    }

    ws.addRow(header1);
    ws.addRow(header2);

    students.forEach(student => {
      const row = [student.sn, student.name];
      teacherSubjects.forEach(sub => {
        const sg = grades[sub.key]?.[student.sn] || grades[sub.name]?.[student.sn] || {};
        if (isKgSheet) {
          const indicators =
            sg.indicators && typeof sg.indicators === 'object' ? sg.indicators : {};
          const ratingCode =
            normalizeKgRatingCode(sg.rating) || deriveKgAreaRatingFromIndicators(indicators);
          const meta = getKgProficiencyMeta(ratingCode);
          const profLabel = ratingCode ? `${ratingCode} (${meta.shortLabel})` : 'Unassessed';
          const totalInd = Object.keys(indicators).length;
          const indMastered = Object.values(indicators).filter(
            (v) => normalizeKgRatingCode(v) === 'IND'
          ).length;
          const milestonesText = totalInd > 0 ? `${indMastered}/${totalInd}` : '-';
          const noteText = String(sg.note || '').trim();
          row.push(profLabel, milestonesText, noteText);
        } else {
          const t1 = Number(sg.gw1 ?? sg.test1) || 0;
          const gw = Number(sg.test ?? sg.groupWork) || 0;
          const t2 = Number(sg.gw2 ?? sg.test2) || 0;
          const pr = Number(sg.proj ?? sg.projectWork) || 0;
          const ex = Number(sg.exams) || 0;
          const sba = t1 + gw + t2 + pr;
          const finalEx = ex / 2;
          const total = sba + finalEx;

          row.push(t1, gw, t2, pr, ex, total);
        }
      });
      ws.addRow(row);
    });

    // Add some column widths for readability
    ws.getColumn(1).width = 5;
    ws.getColumn(2).width = 30;
    if (isKgSheet) {
      for (let i = 0; i < teacherSubjects.length; i++) {
        ws.getColumn(3 + i * 3).width = 18;
        ws.getColumn(4 + i * 3).width = 16;
        ws.getColumn(5 + i * 3).width = 28;
      }
    } else {
      for (let i = 0; i < teacherSubjects.length * 6; i++) {
        ws.getColumn(3 + i).width = 10;
      }
    }
  });

  if (wb.worksheets.length === 0) {
    const ws = wb.addWorksheet("Empty");
    ws.addRow(["No data available"]);
  }

  const sanitizedSchool = (metadata?.schoolName || 'School').replace(/[^a-z0-9]/gi, '_');
  const sanitizedClass = (metadata?.classLevel || 'Class').replace(/[^a-z0-9]/gi, '_');
  const sanitizedYear = (metadata?.academicYear || 'Year').replace(/[^a-z0-9]/gi, '_');
  
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${sanitizedSchool}_${sanitizedClass}_${sanitizedYear}_Archive.xlsx`);
};
