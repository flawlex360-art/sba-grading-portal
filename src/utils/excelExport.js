import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export const exportYearlyData = async (termData, metadata, teacherSubjects) => {
  const wb = new ExcelJS.Workbook();

  // Create a sheet for each term
  ["Term 1", "Term 2", "Term 3"].forEach(termName => {
    const term = termData[termName];
    if (!term || !term.students || term.students.length === 0) return;

    const students = term.students;
    const grades = term.grades || {};

    const ws = wb.addWorksheet(termName);

    // Header Rows
    const header1 = ["", ""];
    const header2 = ["S/N", "Name"];

    teacherSubjects.forEach(sub => {
      header1.push(sub.name, "", "", "", "", ""); // Merge space
      header2.push("Test 1", "Group Work", "Test 2", "Project", "Exams", "Total");
    });
    
    ws.addRow(header1);
    ws.addRow(header2);

    students.forEach(student => {
      const row = [student.sn, student.name];
      teacherSubjects.forEach(sub => {
        const sg = grades[sub.name] && grades[sub.name][student.sn] ? grades[sub.name][student.sn] : {};
        const t1 = Number(sg.test1) || 0;
        const gw = Number(sg.groupWork) || 0;
        const t2 = Number(sg.test2) || 0;
        const pr = Number(sg.projectWork) || 0;
        const ex = Number(sg.exams) || 0;
        const sba = t1 + gw + t2 + pr;
        const finalEx = ex / 2;
        const total = sba + finalEx;

        row.push(t1, gw, t2, pr, ex, total);
      });
      ws.addRow(row);
    });

    // Add some column widths for readability
    ws.getColumn(1).width = 5;
    ws.getColumn(2).width = 30;
    for (let i = 0; i < teacherSubjects.length * 6; i++) {
        ws.getColumn(3 + i).width = 10;
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
