import JSZip from 'jszip';

/**
 * Parses student names from a Word .docx file.
 * The file is expected to contain a table where the second column holds student names.
 * @param {File} file The uploaded docx file object.
 * @returns {Promise<string[]>} A promise resolving to an array of student names.
 */
export const parseDocxRoster = async (file) => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    // Check if word/document.xml exists
    const documentXmlFile = zip.file("word/document.xml");
    if (!documentXmlFile) {
      throw new Error("Invalid .docx file: word/document.xml not found.");
    }
    
    const xmlText = await documentXmlFile.async("text");
    
    // Parse the XML using DOMParser
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "application/xml");
    
    // Check for XML parsing errors
    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      throw new Error("XML parsing error inside docx: " + parserError.textContent);
    }
    
    // Find all table elements
    const tables = xmlDoc.getElementsByTagName("w:tbl");
    if (tables.length === 0) {
      throw new Error("No tables found inside this Word document.");
    }
    
    // We parse the first table
    const table = tables[0];
    const rows = table.getElementsByTagName("w:tr");
    const names = [];
    
    // Loop through rows (skip the first row which is the header)
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const cells = row.getElementsByTagName("w:tc");
      
      // We expect the student name to be in the second cell (index 1)
      if (cells.length > 1) {
        const nameCell = cells[1];
        
        // Extract all text elements <w:t> from this cell
        const tElements = nameCell.getElementsByTagName("w:t");
        let cellText = "";
        for (let t = 0; t < tElements.length; t++) {
          cellText += tElements[t].textContent || "";
        }
        
        const cleanName = cellText.trim();
        if (cleanName && cleanName !== "NAME" && cleanName !== "STUDENT NAME") {
          // Add uppercase name
          names.push(cleanName.toUpperCase());
        }
      }
    }
    
    if (names.length === 0) {
      throw new Error("No valid student names found in the second column of the document table.");
    }
    
    return names;
  } catch (err) {
    console.error("Docx parser error:", err);
    throw new Error(err.message || "Failed to parse Word document.");
  }
};
