import React from 'react';

/**
 * Compact header rendered at the top of Page 2 of printed/previewed report cards
 * so Page 2 stays unmistakably linked to the school, learner, class, and term.
 */
export function ReportContinuationHeader({
  schoolName,
  district,
  sectionTitle,
  studentName,
  classLevel,
  displayTerm,
}) {
  return (
    <div className="border-b-2 border-black pb-2 space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-[15px] font-bold uppercase tracking-wide text-black leading-tight">
            {schoolName}
          </h2>
          {district && (
            <span className="text-[11.5px] font-semibold uppercase tracking-wider text-zinc-700">
              &bull; {district}
            </span>
          )}
        </div>
        <div className="text-[12px] font-bold uppercase tracking-wider text-black">
          {classLevel ? `${classLevel} • ` : ''}Term: {displayTerm}
        </div>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2 pt-1 border-t border-zinc-300">
        <span className="text-[12.5px] font-bold uppercase tracking-widest text-black">
          {sectionTitle}
        </span>
        <span className="text-[13.5px] font-bold uppercase text-black">
          Learner: {studentName}
        </span>
      </div>
    </div>
  );
}

/**
 * High-legibility Conduct, Interest, Class Teacher/Facilitator Remarks,
 * and optional Term 3 Promotion block sized to stay cleanly with grades and
 * signatures on Page 1 on both US Letter and A4 paper.
 */
export function ReportConductRemarksSection({
  conduct,
  interest,
  remarks,
  remarksLabel = "Class Teacher's Remarks:",
  promotedTo = '',
  promotedLabel = 'Promoted to:',
  compact = false,
}) {
  const rows = [
    { label: 'Conduct:', value: conduct || 'N/A', boldValue: false },
    { label: 'Interest:', value: interest || 'N/A', boldValue: false },
    { label: remarksLabel, value: remarks || 'N/A', boldValue: false },
  ];
  if (promotedTo) {
    rows.push({ label: promotedLabel, value: promotedTo, boldValue: true });
  }

  return (
    <div
      className={`border border-zinc-500 rounded bg-zinc-50/50 break-inside-avoid ${
        compact ? 'px-3 py-1.5 space-y-1' : 'px-3.5 py-2 space-y-1.5'
      }`}
    >
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2.5"
        >
          <span
            className={`${
              compact ? 'text-[12.5px] sm:w-[205px]' : 'text-[13.5px] sm:w-[218px]'
            } text-black font-bold uppercase shrink-0 whitespace-nowrap`}
          >
            {row.label}
          </span>
          <span
            className={`${
              row.boldValue ? 'font-bold' : 'font-semibold'
            } ${
              compact ? 'text-[13.5px] leading-tight' : 'text-[15px] leading-snug'
            } text-black border-b border-zinc-500 flex-1 pb-0.5`}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Official Class Teacher / Facilitator and Headteacher signature lines with printed names.
 * Sized to sit reliably at the bottom of Page 1 on both US Letter and A4 without ever spilling.
 */
export function ReportSignaturesBlock({
  teacherLabel = "Class Teacher's Signature",
  teacherName = '',
  headTeacherName = '',
  compact = false,
}) {
  return (
    <div className={`break-inside-avoid ${compact ? 'pt-1' : 'pt-2'}`}>
      <div className="grid grid-cols-2 gap-10 text-center uppercase">
        <div className={`${compact ? 'pt-4' : 'pt-6'} space-y-0.5`}>
          <div className="border-t-[1.5px] border-black pt-1 mx-auto max-w-[235px]" />
          <div className="text-[12.5px] font-bold text-black tracking-wide">{teacherLabel}</div>
          {teacherName && (
            <div className="text-[13.5px] text-black capitalize font-semibold">{teacherName}</div>
          )}
        </div>
        <div className={`${compact ? 'pt-4' : 'pt-6'} space-y-0.5`}>
          <div className="border-t-[1.5px] border-black pt-1 mx-auto max-w-[235px]" />
          <div className="text-[12.5px] font-bold text-black tracking-wide">
            Headteacher&apos;s Signature
          </div>
          {headTeacherName && (
            <div className="text-[13.5px] text-black capitalize font-semibold">{headTeacherName}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Consistent bottom footer showing portal attribution and current page number out of 2.
 */
export function ReportPageFooter({ pageNum, totalPages = 2 }) {
  return (
    <div className="flex items-center justify-between text-[10.5px] text-zinc-700 mt-1.5 border-t border-zinc-300 pt-1 italic">
      <span>Madifor Technologies (0592664865)</span>
      <span className="font-semibold not-italic text-black">
        Page {pageNum} of {totalPages}
      </span>
    </div>
  );
}

/**
 * Return acknowledgment slip rendered on Page 2 cleanly below the Academic Advisory.
 */
export function ParentAcknowledgmentSlip({ statementText, returnToLabel = 'class teacher' }) {
  return (
    <div className="border-[1.5px] border-black rounded p-4 bg-white break-inside-avoid space-y-3.5">
      <div className="flex flex-wrap justify-between items-baseline gap-2 border-b border-zinc-300 pb-1.5">
        <span className="text-[13.5px] font-bold uppercase text-black tracking-wide">
          Parent / Guardian Acknowledgment Slip
        </span>
        <span className="text-[11px] text-zinc-700 italic">
          Please sign and return copy to {returnToLabel}
        </span>
      </div>

      <p className="text-[13.5px] text-black italic leading-snug">{statementText}</p>

      <div className="space-y-2">
        <span className="text-[11.5px] font-bold uppercase text-black block tracking-wide">
          Parent / Guardian Comment (Optional):
        </span>
        <div className="border-b border-zinc-400 h-6" />
      </div>

      <div className="grid grid-cols-3 gap-6 text-[12px] pt-5">
        <div>
          <div className="border-b border-black pb-0.5" />
          <span className="text-[11px] uppercase font-bold text-black block mt-1">
            Parent / Guardian Name
          </span>
        </div>
        <div>
          <div className="border-b border-black pb-0.5" />
          <span className="text-[11px] uppercase font-bold text-black block mt-1">
            Signature
          </span>
        </div>
        <div>
          <div className="border-b border-black pb-0.5" />
          <span className="text-[11px] uppercase font-bold text-black block mt-1">Date</span>
        </div>
      </div>
    </div>
  );
}
