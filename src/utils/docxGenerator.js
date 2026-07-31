import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType, BorderStyle, HeightRule } from 'docx';
import { saveAs } from 'file-saver';

export const generateGradingSheetDocx = async (students, metadata) => {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({ 
        children: [new Paragraph("")], 
        width: { size: 5, type: WidthType.PERCENTAGE },
      }),
      new TableCell({ 
        children: [new Paragraph({ children: [new TextRun({ text: 'NAME', bold: true, size: 22, font: 'Calibri' })], alignment: AlignmentType.CENTER })], 
        width: { size: 40, type: WidthType.PERCENTAGE },
      }),
      new TableCell({ 
        children: [new Paragraph({ children: [new TextRun({ text: 'TEST1\n(20mks)', bold: true, size: 22, font: 'Calibri' })], alignment: AlignmentType.CENTER })], 
        width: { size: 11, type: WidthType.PERCENTAGE },
      }),
      new TableCell({ 
        children: [new Paragraph({ children: [new TextRun({ text: 'GW\n(30mrks)', bold: true, size: 22, font: 'Calibri' })], alignment: AlignmentType.CENTER })], 
        width: { size: 11, type: WidthType.PERCENTAGE },
      }),
      new TableCell({ 
        children: [new Paragraph({ children: [new TextRun({ text: 'TEST2\n(20mks)', bold: true, size: 22, font: 'Calibri' })], alignment: AlignmentType.CENTER })], 
        width: { size: 11, type: WidthType.PERCENTAGE },
      }),
      new TableCell({ 
        children: [new Paragraph({ children: [new TextRun({ text: 'Project\nWork\n(30mks)', bold: true, size: 22, font: 'Calibri' })], alignment: AlignmentType.CENTER })], 
        width: { size: 11, type: WidthType.PERCENTAGE },
      }),
      new TableCell({ 
        children: [new Paragraph({ children: [new TextRun({ text: 'EXAMS\n(100)', bold: true, size: 22, font: 'Calibri' })], alignment: AlignmentType.CENTER })], 
        width: { size: 11, type: WidthType.PERCENTAGE },
      }),
    ],
  });

  const tableRows = [headerRow];

  const createDataRow = (index, name, isGrey) => {
    const fill = isGrey ? 'F2F2F2' : 'FFFFFF';
    return new TableRow({
      height: { value: 600, rule: HeightRule.ATLEAST },
      children: [
        new TableCell({ 
          children: [new Paragraph({ children: [new TextRun({ text: index.toString(), bold: true, size: 22, font: 'Calibri' })], alignment: AlignmentType.CENTER })],
          shading: { fill }
        }),
        new TableCell({ 
          children: [new Paragraph({ children: [new TextRun({ text: name || '', bold: true, size: 22, font: 'Calibri' })], alignment: AlignmentType.CENTER })],
          shading: { fill }
        }),
        new TableCell({ children: [new Paragraph('')], shading: { fill } }),
        new TableCell({ children: [new Paragraph('')], shading: { fill } }),
        new TableCell({ children: [new Paragraph('')], shading: { fill } }),
        new TableCell({ children: [new Paragraph('')], shading: { fill } }),
        new TableCell({ children: [new Paragraph('')], shading: { fill } }),
      ]
    });
  };

  students.forEach((student, index) => {
    const isGrey = index % 2 === 0;
    tableRows.push(createDataRow(index + 1, student.name, isGrey));
  });

  const minRows = 40;
  if (students.length < minRows) {
    for (let i = students.length; i < minRows; i++) {
      const isGrey = i % 2 === 0;
      tableRows.push(createDataRow(i + 1, "", isGrey));
    }
  }

  const table = new Table({
    rows: tableRows,
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
    }
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 },
          },
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: metadata?.schoolName || 'KPANDO ANGLICAN BASIC SCHOOL',
                bold: true,
                size: 24,
                font: 'Calibri',
              })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `ASSESSMENT SHEET (${metadata?.classLevel || 'BASIC 8'})`,
                bold: true,
                size: 24,
                font: 'Calibri',
              })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "SUBJECT:__________________________________        TEACHER'S NAME:__________________________________",
                size: 24,
                font: 'Calibri',
              })
            ],
            alignment: AlignmentType.LEFT,
            spacing: { after: 200 },
          }),
          table,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `SBA_Grading_Sheet_${metadata?.classLevel || 'Class'}.docx`);
};
