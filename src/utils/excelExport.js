import * as XLSX from 'xlsx';

export const exportYearlyData = (termData, metadata, teacherSubjects) => {
  const wb = XLSX.utils.book_new();

  // Create a sheet for each term
  ["Term 1", "Term 2", "Term 3"].forEach(termName => {
    const term = termData[termName];
    if (!term || !term.students || term.students.length === 0) return;

    const students = term.students;
    const grades = term.grades || {};

    const sheetData = [];

    // Header Rows
    const header1 = ["", ""];
    const header2 = ["S/N", "Name"];

    teacherSubjects.forEach(sub => {
      header1.push(sub.name, "", "", "", "", ""); // Merge space
      header2.push("Test 1", "Group Work", "Test 2", "Project", "Exams", "Total");
    });
    
    sheetData.push(header1);
    sheetData.push(header2);

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
      sheetData.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    
    // Add some column widths for readability
    const wscols = [{wch: 5}, {wch: 30}];
    for (let i = 0; i < teacherSubjects.length * 6; i++) {
        wscols.push({wch: 10});
    }
    ws['!cols'] = wscols;

    XLSX.utils.book_append_sheet(wb, ws, termName);
  });

  if (wb.SheetNames.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([["No data available"]]);
    XLSX.utils.book_append_sheet(wb, ws, "Empty");
  }

  const sanitizedSchool = (metadata?.schoolName || 'School').replace(/[^a-z0-9]/gi, '_');
  const sanitizedClass = (metadata?.classLevel || 'Class').replace(/[^a-z0-9]/gi, '_');
  const sanitizedYear = (metadata?.academicYear || 'Year').replace(/[^a-z0-9]/gi, '_');
  
  XLSX.writeFile(wb, `${sanitizedSchool}_${sanitizedClass}_${sanitizedYear}_Archive.xlsx`);
};
