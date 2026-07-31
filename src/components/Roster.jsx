import React, { useState, useEffect } from 'react';
import { Upload, Plus, Trash2, Edit2, Check, X, FileSpreadsheet, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { parseDocxRoster } from '../utils/docxParser';
import { generateGradingSheetDocx } from '../utils/docxGenerator';

export default function Roster({ students, metadata, onSave, onImport, isReadOnly }) {
  const [list, setList] = useState([...students]);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentGender, setNewStudentGender] = useState('U'); // U=Unspecified, M=Male, F=Female
  const [editingSn, setEditingSn] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [editingGender, setEditingGender] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Synchronize local list state with parent students prop
  useEffect(() => {
    setList(students);
  }, [students]);

  const sortAndReindex = (rosterList) => {
    const sorted = [...rosterList].sort((a, b) => a.name.localeCompare(b.name));
    const snMap = {};
    const reindexed = sorted.map((student, index) => {
      const newSn = index + 1;
      if (student.sn && student.sn < 1000000) {
        snMap[student.sn] = newSn;
      }
      return { ...student, sn: newSn };
    });
    return { reindexed, snMap };
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    const rawList = [...list, {
      sn: 9999999, // Temporary dummy ID for new students
      name: newStudentName.trim().toUpperCase(),
      gender: newStudentGender,
      attendance: 0,
      conduct: '',
      interest: '',
      remarks: '',
      promotedTo: ''
    }];
    
    const { reindexed, snMap } = sortAndReindex(rawList);
    setList(reindexed);
    setNewStudentName('');
    setNewStudentGender('U');
    setIsSaving(true);
    await onSave(reindexed, snMap);
    setIsSaving(false);
  };

  const handleRemove = async (sn) => {
    const rawList = list.filter(s => s.sn !== sn);
    const { reindexed, snMap } = sortAndReindex(rawList);
    setList(reindexed);
    setIsSaving(true);
    await onSave(reindexed, snMap);
    setIsSaving(false);
  };

  const startEdit = (student) => {
    setEditingSn(student.sn);
    setEditingName(student.name);
    setEditingGender(student.gender || 'U');
  };

  const cancelEdit = () => {
    setEditingSn(null);
    setEditingName('');
    setEditingGender('');
  };

  const saveEdit = async (sn) => {
    if (!editingName.trim()) return;
    const rawList = list.map(s => s.sn === sn ? { ...s, name: editingName.trim().toUpperCase(), gender: editingGender } : s);
    const { reindexed, snMap } = sortAndReindex(rawList);
    setList(reindexed);
    setEditingSn(null);
    setEditingName('');
    setEditingGender('');
    setIsSaving(true);
    await onSave(reindexed, snMap);
    setIsSaving(false);
  };

  const handleClear = () => {
    toast.custom((t) => (
      <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-white dark:bg-zinc-900 shadow-2xl rounded-xl pointer-events-auto flex flex-col p-5 border border-zinc-200 dark:border-zinc-800`}>
        <p className="text-sm font-bold text-zinc-900 dark:text-white mb-1">Clear Roster?</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Are you sure you want to clear the entire roster? All grades will be preserved, but student links will be reset.</p>
        <div className="flex justify-end gap-2 mt-4">
          <button 
            className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg text-xs font-semibold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            onClick={() => toast.dismiss(t.id)}
          >
            Cancel
          </button>
          <button 
            className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition-colors"
            onClick={async () => {
              toast.dismiss(t.id);
              setList([]);
              setIsSaving(true);
              await onSave([]);
              setIsSaving(false);
              toast.success("Roster cleared!");
            }}
          >
            Clear Roster
          </button>
        </div>
      </div>
    ), { duration: Infinity });
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
    const isDocx = file.name.endsWith('.docx');

    if (!isDocx) {
      setUploadError('Only Word (.docx) files are supported.');
      return;
    }

    setIsSaving(true);

    try {
      const names = await parseDocxRoster(file);
      const rawList = names.map((name, i) => ({
        sn: 9999999 + i, // Temporary dummy ID
        name: name.toUpperCase(),
        gender: "U",
        attendance: 0,
        conduct: "",
        interest: "",
        remarks: "",
        promotedTo: ""
      }));

      const { reindexed, snMap } = sortAndReindex(rawList);
      setList(reindexed);
      await onImport(reindexed, snMap);
      setIsSaving(false);
    } catch (err) {
      console.error(err);
      setUploadError(err.message || 'Failed to parse file. Make sure it is a valid .docx file.');
      toast.error('Failed to import roster');
      setIsSaving(false);
    }
  };

  const handleDownloadSheet = async () => {
    try {
      await generateGradingSheetDocx(list, metadata);
      toast.success('Grading sheet generated successfully');
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate document');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Add Student & Excel Roster Upload */}
        <div className="space-y-6 lg:col-span-1">
          {/* Add New Student Form */}
          <div className="glass-card p-6 relative">
            {isReadOnly && (
              <div className="absolute inset-0 bg-white/50 dark:bg-zinc-950/50 z-10 flex items-center justify-center backdrop-blur-[1px] rounded-2xl">
                <span className="bg-amber-100 dark:bg-amber-900/80 text-amber-800 dark:text-amber-400 px-3 py-1 text-[10px] font-bold rounded-lg border border-amber-300 dark:border-amber-700">Archived Term (Read-Only)</span>
              </div>
            )}
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-4 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-blue-500" />
              Quick Add
            </h3>
            <form onSubmit={handleAdd} className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="SURNAME FIRSTNAME"
                  disabled={isReadOnly}
                  className="flex-1 bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 disabled:opacity-50"
                />
                <select 
                  value={newStudentGender}
                  onChange={(e) => setNewStudentGender(e.target.value)}
                  disabled={isReadOnly}
                  className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
                >
                  <option value="U">Gen</option>
                  <option value="M">M</option>
                  <option value="F">F</option>
                </select>
                <button
                  type="submit"
                  disabled={isReadOnly || !newStudentName.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg p-2 transition-colors shadow-sm disabled:opacity-50"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>

          {/* Roster Import Card */}
          <div className="glass-card p-6 relative">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-4 flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-emerald-500" />
              Import Roster (Word)
            </h3>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${!isReadOnly ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'} ${
                isDragging 
                  ? 'border-blue-500 bg-blue-50/10' 
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              <input
                type="file"
                id="roster-file"
                onChange={handleFileSelect}
                accept=".docx"
                disabled={isReadOnly}
                className="hidden"
              />
              <label htmlFor={isReadOnly ? "" : "roster-file"} className={`${!isReadOnly ? 'cursor-pointer' : 'cursor-not-allowed'} space-y-2 block`}>
                <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">Click to upload</span> or drag and drop
                </div>
                <div className="text-[10px] text-zinc-400">
                  Word (.docx) document containing roster
                </div>
              </label>
            </div>

            {uploadError && (
              <div className="mt-3 bg-zinc-900 border border-zinc-800 text-white text-xs rounded-lg p-3 flex gap-2 items-start shadow-md">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
                <span className="font-medium">{uploadError}</span>
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
                  onClick={handleDownloadSheet}
                  disabled={list.length === 0}
                  className="bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  title="Generate a blank Word grading sheet with student names"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Print Sheet
                </button>
                <button
                  onClick={handleClear}
                  disabled={list.length === 0 || isSaving || isReadOnly}
                  className="bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-lg px-3 py-1.5 text-xs font-semibold border border-zinc-200 dark:border-zinc-800 transition-colors disabled:opacity-50"
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
                    <th className="px-2 py-2.5 w-16 text-center">Gender</th>
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
                      <td className="px-2 py-3 text-center">
                        {editingSn === student.sn ? (
                          <select 
                            value={editingGender}
                            onChange={(e) => setEditingGender(e.target.value)}
                            className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="U">-</option>
                            <option value="M">M</option>
                            <option value="F">F</option>
                          </select>
                        ) : (
                          <span className={`text-xs font-bold px-2 py-1 rounded ${
                            student.gender === 'M' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                            student.gender === 'F' ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' :
                            'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'
                          }`}>
                            {student.gender === 'M' ? 'M' : student.gender === 'F' ? 'F' : 'U'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 flex justify-end gap-1.5 min-w-[70px]">
                        {editingSn === student.sn ? (
                          <>
                            <button onClick={() => saveEdit(student.sn)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={cancelEdit} className="p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button 
                              onClick={() => startEdit(student)} 
                              disabled={isReadOnly}
                              className="p-1 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors disabled:opacity-50"
                              title="Edit Student Name"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleRemove(student.sn)} 
                              disabled={isReadOnly}
                              className="p-1 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded transition-colors disabled:opacity-50"
                              title="Remove Student"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {list.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-12 text-center text-zinc-400">
                        No students enrolled. Upload a Word file or add students manually.
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
