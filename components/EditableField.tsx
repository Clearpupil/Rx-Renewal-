import React from 'react';

interface EditableFieldProps {
  label: string;
  value: string;
  isEditing: boolean;
  onChange?: (value: string) => void;
  multiline?: boolean;
  gridClass?: string;
}

const EditableField: React.FC<EditableFieldProps> = ({
  label,
  value,
  isEditing,
  onChange,
  multiline = false,
  gridClass = ''
}) => {
  return (
    <div className={gridClass}>
      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
        {label}
      </span>
      {isEditing ? (
        multiline ? (
          <textarea
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-teal-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
            rows={3}
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-teal-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        )
      ) : (
        <p className={`font-medium text-slate-900 ${multiline ? 'whitespace-pre-wrap' : ''}`}>
          {value}
        </p>
      )}
    </div>
  );
};

export default EditableField;
