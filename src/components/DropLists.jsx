import React, { useState } from 'react';
import { Settings, Plus, Trash2, Save } from 'lucide-react';

export default function DropLists({ dropLists, onSave }) {
  const [lists, setLists] = useState({ ...dropLists });
  const [inputs, setInputs] = useState({ conduct: '', interest: '', remarks: '' });
  const [isSaving, setIsSaving] = useState(false);

  const handleAdd = (listKey) => {
    const val = inputs[listKey].trim();
    if (!val) return;
    if (lists[listKey].includes(val)) return;

    setLists(prev => ({
      ...prev,
      [listKey]: [...prev[listKey], val]
    }));
    setInputs(prev => ({ ...prev, [listKey]: '' }));
  };

  const handleRemove = (listKey, item) => {
    setLists(prev => ({
      ...prev,
      [listKey]: prev[listKey].filter(x => x !== item)
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(lists);
    setIsSaving(false);
  };

  const renderListEditor = (listKey, title, placeholder, accentColor) => {
    const listItems = lists[listKey] || [];
    return (
      <div className="glass-card p-5 flex flex-col h-[400px]">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-2 flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${accentColor}`} />
          {title} ({listItems.length})
        </h3>
        
        {/* Add Input */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder={placeholder}
            value={inputs[listKey]}
            onChange={(e) => setInputs(prev => ({ ...prev, [listKey]: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd(listKey)}
            className="flex-1 bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={() => handleAdd(listKey)}
            className="bg-zinc-800 hover:bg-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white rounded-lg p-1.5 text-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable list items */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-lg">
          {listItems.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors">
              <span className="text-xs text-zinc-700 dark:text-zinc-300 font-medium truncate max-w-[200px]" title={item}>
                {item}
              </span>
              <button
                onClick={() => handleRemove(listKey, item)}
                className="text-zinc-400 hover:text-rose-600 p-1 rounded transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {listItems.length === 0 && (
            <div className="text-center py-12 text-xs text-zinc-400">
              List is empty.
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Settings Header */}
      <div className="glass-panel p-4 rounded-xl flex items-center justify-between no-print">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-500" />
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Drop List Settings</h2>
            <p className="text-[10px] text-zinc-400">
              Configure selections for student conduct, interest activities, and class remarks.
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
        >
          <Save className="w-4 h-4" />
          {isSaving ? "Saving..." : "Save Config"}
        </button>
      </div>

      {/* Grid of lists */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {renderListEditor("conduct", "Conduct Remarks", "Enter new conduct remark...", "bg-blue-500")}
        {renderListEditor("interest", "Student Interests", "Enter new interest activity...", "bg-indigo-500")}
        {renderListEditor("remarks", "Class Teacher Remarks", "Enter teacher remark...", "bg-emerald-500")}
      </div>
    </div>
  );
}
