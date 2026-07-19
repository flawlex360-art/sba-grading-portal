import React, { useState, useEffect } from 'react';
import { Upload, Plus, Trash2, Edit2, Check, X, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { parseDocxRoster } from '../utils/docxParser';

export default function Roster({ students, onSave, onImport }) {
  const [list, setList] = useState([...students]);
  const [newStudentName, setNewStudentName] = useState('');
  const [editingSn, setEditingSn] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Synchronize local list state with parent students prop
  useEffect(() => {
    setList(students);
  }, [students]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    const newSn = list.length > 0 ? Math.max(...list.map(s => s.sn)) + 1 : 1;
    const updatedList = [...list, {
      sn: newSn,
      name: newStudentName.trim().toUpperCase(),
      attendance: 0,
      conduct: '',
      interest: '',
      remarks: '',
      promotedTo: ''
    }];
    setList(updatedList);
    setNewStudentName('');
    setIsSaving(true);
    await onSave(updatedList);
    setIsSaving(false);
  };

  const handleRemove = async (sn) => {
    const updatedList = list.filter(s => s.sn !== sn).map((s, idx) => ({ ...s, sn: idx + 1 }));
    setList(updatedList);
    setIsSaving(true);
    await onSave(updatedList);
    setIsSaving(false);
  };

  const startEdit = (student) => {
    setEditingSn(student.sn);
    setEditingName(student.name);
  };

  const cancelEdit = () => {
    setEditingSn(null);
    setEditingName('');
  };

  const saveEdit = async (sn) => {
    if (!editingName.trim()) return;
    const updatedList = list.map(s => s.sn === sn ? { ...s, name: editingName.trim().toUpperCase() } : s);
    setList(updatedList);
    setEditingSn(null);
    setEditingName('');
    setIsSaving(true);
    await onSave(updatedList);
    setIsSaving(false);
  };

  const handleClear = async () => {
    if (window.confirm("Are you sure you want to clear the entire roster? All grades will be preserved, but student links will be reset.")) {
      setList([]);
      setIsSaving(true);
      await onSave([]);
      setIsSaving(false);
    }
  };

  // Drag and Drop File Handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    setUploadError('');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleFileSelect = async (e) => {
    setUploadError('');
    const files = e.target.files;
    if (files.length > 0) {
      await processFile(files[0]);
    }
  };

  const processFile = async (file) => {
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const isDocx = file.name.endsWith('.docx');

    if (!isExcel && !isDocx) {
      setUploadError('Only Excel (.xlsx, .xls) and Word (.docx) files are supported.');
      return;
    }

    setIsSaving(true);

    if (isDocx) {
      try {
        const names = await parseDocxRoster(file);
        const importedStudents = names.map((name, i) => ({
          sn: i + 1,
          name: name.toUpperCase(),
          attendance: 0,
          conduct: "",
          interest: "",
          remarks: "",
          promotedTo: ""
        }));

        setList(importedStudents);
        await onImport(importedStudents);
        setIsSaving(false);
      } catch (err) {
        console.error(err);
        setUploadError(err.message || 'An error occurred during Word document import.');
        setIsSaving(false);
      }
    } else {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const XLSX = await import('xlsx');
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames.find(n => n.toUpperCase() === "NAMES");
          if (!sheetName) {
            throw new Error("'NAMES' tab sheet not found in the Excel file.");
          }
          const worksheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          const names = [];
          
          for (let idx = 0; idx < rows.length; idx++) {
            if (idx >= 7) { // Row 8 is index 7
              const row = rows[idx];
              if (row && row.length > 4) {
                const nameVal = String(row[4]).trim();
                if (nameVal && nameVal !== "Name (Surname First)" && nameVal !== "undefined" && nameVal !== "") {
                  names.push(nameVal);
                }
              }
            }
          }
          
          if (names.length === 0) {
            throw new Error("No student names found in Column E starting at Row 8.");
          }
          
          const importedStudents = names.map((name, i) => ({
            sn: i + 1,
            name: name.toUpperCase(),
            attendance: 0,
            conduct: "",
            interest: "",
            remarks: "",
            promotedTo: ""
          }));

          setList(importedStudents);
          await onImport(importedStudents);
          setIsSaving(false);
        } catch (err) {
          console.error(err);
          setUploadError(err.message || 'An error occurred during local Excel import.');
          setIsSaving(false);
        }
      };
      reader.onerror = () => {
        setUploadError('Failed to read the file.');
        setIsSaving(false);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Add Student & Excel Roster Upload */}
        <div className="space-y-6 lg:col-span-1">
          {/* Add Student Card */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-4">Add Single Student</h3>
            <form onSubmit={handleAdd} className="flex gap-2">
              <input
                type="text"
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                placeholder="SURNAME FIRSTNAME"
                className="flex-1 bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg p-2 transition-colors shadow-sm"
              >
                <Plus className="w-5 h-5" />
              </button>
            </form>
          </div>

          {/* Roster Import Card */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-4 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              Import Roster (Excel / Word)
            </h3>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                isDragging 
                  ? 'border-blue-500 bg-blue-50/10' 
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              <input
                type="file"
                id="roster-file"
                onChange={handleFileSelect}
                accept=".xlsx, .xls, .docx"
                className="hidden"
              />
              <label htmlFor="roster-file" className="cursor-pointer space-y-2 block">
                <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">Click to upload</span> or drag and drop
                </div>
                <div className="text-[10px] text-zinc-400">
                  Excel (.xlsx) or Word (.docx) document containing roster
                </div>
              </label>
            </div>

            {uploadError && (
              <div className="mt-3 bg-red-500/10 border border-red-500/30 text-red-500 text-xs rounded-lg p-3 flex gap-2 items-start">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Roster Table Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
              <span className="text-sm font-bold uppercase tracking-wider text-zinc-500">Student Roster ({list.length})</span>
              <div className="flex gap-2">
                <button
                  onClick={handleClear}
                  disabled={list.length === 0 || isSaving}
                  className="bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-lg px-3 py-1.5 text-xs font-semibold border border-zinc-200 dark:border-zinc-800 transition-colors"
                >
                  Clear All
                </button>
                {isSaving && (
                  <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider animate-pulse self-center mr-1">
                    Auto-saving...
                  </span>
                )}
              </div>
            </div>

            <div className="max-h-[480px] overflow-y-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold select-none z-10">
                  <tr>
                    <th className="px-4 py-2.5 w-16 text-center">S/N</th>
                    <th className="px-4 py-2.5">Student Name (Surname First)</th>
                    <th className="px-4 py-2.5 w-24 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {list.map((student, idx) => (
                    <tr key={student.sn} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                      <td className="px-4 py-3 text-center font-mono font-medium text-zinc-500">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        {editingSn === student.sn ? (
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        ) : (
                          <span className="font-semibold tracking-tight">{student.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          {editingSn === student.sn ? (
                            <>
                              <button
                                onClick={() => saveEdit(student.sn)}
                                className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded transition-colors"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1 text-rose-500 hover:bg-rose-500/10 rounded transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(student)}
                                className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRemove(student.sn)}
                                className="p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-500/10 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {list.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-12 text-center text-zinc-400">
                        No students enrolled. Upload an Excel file or add students manually.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
