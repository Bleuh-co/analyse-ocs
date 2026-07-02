"use client";

import { useCallback, useState, useRef, type DragEvent, type ChangeEvent } from "react";

interface FileDropZoneProps {
  onFile: (file: File) => void;
  accept?: string;
  maxSizeMB?: number;
  disabled?: boolean;
}

export function FileDropZone({
  onFile,
  accept = ".xlsx,.xls",
  maxSizeMB = 10,
  disabled = false,
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = useCallback(
    (file: File): boolean => {
      setError(null);
      const name = file.name.toLowerCase();
      if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
        setError("Seuls les fichiers .xlsx / .xls sont acceptés");
        return false;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`Le fichier dépasse ${maxSizeMB} MB`);
        return false;
      }
      return true;
    },
    [maxSizeMB]
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file && validate(file)) onFile(file);
    },
    [onFile, validate, disabled]
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && validate(file)) onFile(file);
      // Reset input pour pouvoir re-sélectionner le même fichier
      if (inputRef.current) inputRef.current.value = "";
    },
    [onFile, validate]
  );

  return (
    <div
      className={`drop-zone${isDragging ? " drop-zone--active" : ""}${disabled ? " drop-zone--disabled" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
    >
      <div className="drop-zone-content">
        <svg
          viewBox="0 0 24 24"
          width="48"
          height="48"
          style={{ color: "var(--chanv-beige)", marginBottom: "16px" }}
        >
          <path
            fill="currentColor"
            d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M12,12L16,16H13.5V19H10.5V16H8L12,12Z"
          />
        </svg>
        <p className="drop-title">
          Glisser-déposer le fichier <strong>.xlsx</strong> ici
        </p>
        <p className="drop-subtitle">
          ou cliquer pour sélectionner — Fichier reçu de l&apos;OCS (ex: data (28).xlsx)
        </p>
        {error && <p className="drop-error">{error}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        style={{ display: "none" }}
      />
    </div>
  );
}
