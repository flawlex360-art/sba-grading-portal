import React from 'react';

/**
 * Compact header rendered at the top of Pages 2 and 3 of printed/previewed report cards
 * so detached sheets remain clearly identified by school, learner, class, and term.
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
    <div className="border-b-2 border-black pb-3 space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-[16px] font-bold uppercase tracking-wide text-black leading-tight">
            {schoolName}
          </h2>
          {district && (
            <div className="text-[11.5px] font-semibold uppercase tracking-wider text-zinc-700">
              {district}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-[12px] font-bold uppercase tracking-wider text-black">
            Term: {displayTerm}
          </div>
          {classLevel && (
            <div className="text-[12px] font-semibold uppercase text-zinc-700">
              Class: {classLevel}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2 pt-1.5 border-t border-zinc-300">
        <span className="text-[13px] font-bold uppercase tracking-widest text-black">
          {sectionTitle}
        </span>
        <span className="text-[14px] font-bold uppercase text-black">
          Learner: {studentName}
        </span>
      </div>
    </div>
  );
}

/**
 * Large, high-legibility Conduct, Interest, Class Teacher/Facilitator Remarks,
 * and optional Term 3 Promotion block designed for easy reading by parents.
 */
export function ReportConductRemarksSection({
  conduct,
  interest,
  remarks,
  remarksLabel = "Class Teacher's Remarks:",
  promotedTo = '',
  promotedLabel = 'Promoted to:',
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
    <div className="border-[1.5px] border-black rounded p-4 sm:p-5 bg-zinc-50/60 space-y-4">
      <div className="text-[13.5px] font-bold uppercase tracking-wider text-black border-b border-zinc-300 pb-2">
        Conduct, Interest &amp; Remarks
      </div>
      <div className="space-y-4 text-[15px]">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col sm:flex-row sm:items-baseline gap-1.5 sm:gap-3">
            <span className="text-black font-bold uppercase sm:w-[245px] shrink-0 whitespace-nowrap">
              {row.label}
            </span>
            <span
              className={`${
                row.boldValue ? 'font-bold' : 'font-semibold'
              } text-[16.5px] text-black border-b border-zinc-500 flex-1 pb-1 leading-relaxed`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Official Class Teacher / Facilitator and Headteacher signature lines with printed names.
 */
export function ReportSignaturesBlock({
  teacherLabel = "Class Teacher's Signature",
  teacherName = '',
  headTeacherName = '',
}) {
  return (
    <div className="break-inside-avoid pt-6 pb-2">
      <div className="grid grid-cols-2 gap-10 text-center uppercase">
        <div className="pt-8 space-y-1.5">
          <div className="border-t-[1.5px] border-black pt-2 mx-auto max-w-[240px]" />
          <div className="text-[13px] font-bold text-black tracking-wide">{teacherLabel}</div>
          {teacherName && (
            <div className="text-[14.5px] text-black capitalize font-semibold">{teacherName}</div>
          )}
        </div>
        <div className="pt-8 space-y-1.5">
          <div className="border-t-[1.5px] border-black pt-2 mx-auto max-w-[240px]" />
          <div className="text-[13px] font-bold text-black tracking-wide">
            Headteacher&apos;s Signature
          </div>
          {headTeacherName && (
            <div className="text-[14.5px] text-black capitalize font-semibold">{headTeacherName}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Consistent bottom footer showing portal attribution and current page number out of 3.
 */
export function ReportPageFooter({ pageNum, totalPages = 3 }) {
  return (
    <div className="flex items-center justify-between text-[11px] text-zinc-700 mt-3 border-t border-zinc-300 pt-2 italic">
      <span>Madifor Technologies (0592664865)</span>
      <span className="font-semibold not-italic text-black">
        Page {pageNum} of {totalPages}
      </span>
    </div>
  );
}

/**
 * Tear-off / return acknowledgment slip rendered on Page 3 with space for parent feedback.
 */
export function ParentAcknowledgmentSlip({ statementText, returnToLabel = 'class teacher' }) {
  return (
    <div className="border-[1.5px] border-black rounded p-5 bg-white break-inside-avoid space-y-5">
      <div className="flex flex-wrap justify-between items-baseline gap-2 border-b border-zinc-300 pb-2">
        <span className="text-[14px] font-bold uppercase text-black tracking-wide">
          Parent / Guardian Acknowledgment Slip
        </span>
        <span className="text-[11.5px] text-zinc-700 italic">
          Please sign and return copy to {returnToLabel}
        </span>
      </div>

      <p className="text-[14px] text-black italic leading-relaxed">{statementText}</p>

      <div className="space-y-3 pt-1">
        <span className="text-[12px] font-bold uppercase text-black block tracking-wide">
          Parent / Guardian Comments:
        </span>
        <div className="border-b border-zinc-400 h-7" />
        <div className="border-b border-zinc-400 h-7" />
      </div>

      <div className="grid grid-cols-3 gap-6 text-[12.5px] pt-8">
        <div>
          <div className="border-b border-black pb-1" />
          <span className="text-[11.5px] uppercase font-bold text-black block mt-1.5">
            Parent / Guardian Name
          </span>
        </div>
        <div>
          <div className="border-b border-black pb-1" />
          <span className="text-[11.5px] uppercase font-bold text-black block mt-1.5">
            Signature
          </span>
        </div>
        <div>
          <div className="border-b border-black pb-1" />
          <span className="text-[11.5px] uppercase font-bold text-black block mt-1.5">Date</span>
        </div>
      </div>
    </div>
  );
}
