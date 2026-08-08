import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X, Upload, FileText, CheckCircle2, AlertCircle, Plus, Download } from "lucide-react";
import { useConcepts } from "../context/ConceptContext";
import { useScrollLock } from "../hooks/useScrollLock";

type ParsedRow = {
  prompt: string;
  answer: string;
  hint: string | null;
  tags: string[];
  valid: boolean;
  error?: string;
};

type Props = {
  boardId: string;
  open: boolean;
  onClose: () => void;
  /** Called after a successful import so the host page can refresh its data. */
  onImported?: () => void | Promise<void>;
};

/** Words that mark a CSV line as a header/naming row instead of concept data. */
const HEADER_WORDS = new Set(["prompt", "answer", "hint", "tags"]);

/**
 * Split a CSV/TSV line into fields on the given delimiter, honoring
 * double-quoted cells (e.g. answers or tag lists that contain commas). Quotes
 * are consumed and `""` collapses to a literal quote.
 */
function parseLine(line: string, delimiter: "," | "\t"): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      fields.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Parse raw CSV/TSV text into concept rows. Column order is fixed — prompt,
 * answer, hint, then tags — but column *names* don't matter. The delimiter is
 * detected per file (tabs win over commas, so spreadsheet paste / TSV exports
 * work); the tags column is always a comma-separated list.
 *
 * Only the FIRST row is treated as a possible naming row (its cells spelling
 * out "prompt/answer/hint/tags") and skipped. Checking just the first row is
 * important: real data rows may legitimately contain the word "hint" as a hint
 * value, and they must never be dropped as "headers".
 */
function parseCSV(text: string): ParsedRow[] {
  // Drop a UTF-8 BOM that editors sometimes prepend to the first cell.
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows: ParsedRow[] = [];
  const delimiter: "," | "\t" = lines[0]?.includes("\t") ? "\t" : ",";

  // The naming row is checked exactly once, on the first line only — data
  // rows can legitimately contain "hint"/"tags" as values and must never be
  // dropped, so the header test never runs against a data row.
  const isHeader =
    lines.length > 0 &&
    parseLine(lines[0], delimiter).some((f) => HEADER_WORDS.has(f.toLowerCase()));

  for (let i = isHeader ? 1 : 0; i < lines.length; i += 1) {
    const fields = parseLine(lines[i], delimiter);

    const prompt = fields[0] ?? "";
    const answer = fields[1] ?? "";
    const hint = fields[2] ?? "";
    // Everything after the hint counts as tags; handle both a quoted
    // "a,b,c" cell and plain extra columns.
    const rawTags = fields.slice(3).join(",");
    const tags = rawTags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    if (!prompt) {
      rows.push({ prompt, answer, hint: hint || null, tags, valid: false, error: "Missing prompt" });
      continue;
    }
    if (!answer) {
      rows.push({ prompt, answer, hint: hint || null, tags, valid: false, error: "Missing answer" });
      continue;
    }
    rows.push({ prompt, answer, hint: hint || null, tags: [...new Set(tags)], valid: true });
  }

  return rows;
}

/**
 * Modal for bulk-importing concepts from a CSV file. Parses the file on the
 * client for a preview (valid/error rows), then sends the rows to the backend
 * import endpoint, which batch-creates tags, then concepts, then the links.
 */
export function CSVUploadModal({ boardId, open, onClose, onImported }: Props) {
  useScrollLock(open);
  const { importConcepts } = useConcepts();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  function handleFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      setRows(parsed);
      setImportError(null);
      setStep("preview");
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) handleFile(file);
  }

  async function handleImport() {
    const valid = rows.filter((r) => r.valid);
    if (valid.length === 0 || isImporting) return;
    setIsImporting(true);
    setImportError(null);
    const payload = valid.map((r) => ({
      prompt: r.prompt,
      answer: r.answer,
      hint: r.hint,
      tags: r.tags,
    }));
    try {
      // The context appends the created concepts to local state, so the board
      // page updates immediately without a refetch.
      await importConcepts(boardId, payload);
      await onImported?.();
      reset();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  }

  function reset() {
    setRows([]);
    setFileName("");
    setStep("upload");
    setImportError(null);
    onClose();
  }

  function downloadTemplate() {
    const csv = [
      "prompt,answer,hint,tags",
      "What is useEffect?,A React hook that runs side effects after render.,Pass a dependency array to control when it runs.,hooks,react,intermediate",
      "What is Big-O notation?,Describes the upper bound of an algorithm's complexity as input grows.,,algorithms,theory,beginner",
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "concepts-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const validCount = rows.filter((r) => r.valid).length;
  const errorCount = rows.filter((r) => !r.valid).length;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={reset}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden max-h-[90vh] flex flex-col"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {/* header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-foreground">Upload CSV</h2>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                  Bulk import concepts from a CSV file
                </p>
              </div>
              <button onClick={reset} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-5 px-6 py-5 overflow-y-auto">
              {step === "upload" ? (
                <>
                  {/* drop zone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileRef.current?.click()}
                    className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl py-10 transition-all cursor-pointer ${
                      isDragging
                        ? "border-primary bg-primary/8 text-foreground"
                        : "border-border hover:border-primary/50 hover:bg-secondary/50 text-muted-foreground"
                    }`}
                  >
                    <Upload className="w-8 h-8 opacity-50" />
                    <div className="text-center">
                      <p className="text-sm">Drop a CSV file here, or click to browse</p>
                      <p className="text-[11px] font-mono mt-1 opacity-70">.csv files only</p>
                    </div>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                  />

                  {/* format guide */}
                  <div className="bg-secondary border border-border rounded-xl p-4 flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Expected format</p>
                    <div className="font-mono text-[11px] text-muted-foreground space-y-1">
                      <p><span className="text-foreground">Column 1</span> — Prompt <span className="text-primary/60">(required)</span></p>
                      <p><span className="text-foreground">Column 2</span> — Answer <span className="text-primary/60">(required)</span></p>
                      <p><span className="text-foreground">Column 3</span> — Hint <span className="text-primary/60">(optional)</span></p>
                      <p><span className="text-foreground">Column 4</span> — Tags, separated by <span className="text-primary">commas</span></p>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono leading-relaxed">
                      Column names don't matter — only the order. A naming row (e.g.{" "}
                      <span className="text-primary">prompt,answer,hint,tags</span>) is skipped automatically.
                    </p>
                    <div className="mt-1 p-2 rounded-lg bg-card border border-border font-mono text-[10px] text-muted-foreground">
                      prompt,answer,hint,tags<br />
                      What is useEffect?,A React hook...,hooks,react<br />
                      Big-O notation,Describes complexity...,algorithms
                    </div>
                    <button
                      onClick={downloadTemplate}
                      className="flex items-center gap-1.5 text-[11px] text-primary hover:underline mt-1 w-fit"
                    >
                      <Download className="w-3 h-3" />
                      Download template
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* preview header */}
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-secondary border border-border">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground flex-1 truncate">{fileName}</span>
                    <div className="flex items-center gap-3 shrink-0 font-mono text-[11px]">
                      {validCount > 0 && (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />{validCount} valid
                        </span>
                      )}
                      {errorCount > 0 && (
                        <span className="flex items-center gap-1 text-rose-400">
                          <AlertCircle className="w-3 h-3" />{errorCount} error{errorCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* rows preview */}
                  <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                    {rows.map((row, i) => (
                      <div
                        key={i}
                        className={`rounded-xl px-4 py-3 border flex flex-col gap-1.5 ${
                          row.valid ? "bg-card border-border" : "bg-rose-500/5 border-rose-500/20"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {row.valid
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            : <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${row.valid ? "text-foreground" : "text-rose-400"}`}>
                              {row.prompt || <span className="italic opacity-60">No prompt</span>}
                            </p>
                            {row.error && <p className="text-[11px] text-rose-400 font-mono mt-0.5">{row.error}</p>}
                            {row.answer && (
                              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{row.answer}</p>
                            )}
                            {row.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {row.tags.map((tag) => (
                                  <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">{tag}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* re-upload */}
                  <button
                    onClick={() => { setStep("upload"); setRows([]); setFileName(""); }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
                  >
                    ← Choose a different file
                  </button>
                </>
              )}
            </div>

            {/* footer */}
            {step === "preview" && (
              <div className="flex flex-col gap-2 px-6 py-4 border-t border-border shrink-0">
                {importError && <p className="text-xs text-rose-400 font-mono">{importError}</p>}
                <div className="flex items-center gap-3">
                  <button onClick={reset} className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={validCount === 0 || isImporting}
                    className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {isImporting
                      ? "Importing…"
                      : `Import ${validCount} concept${validCount !== 1 ? "s" : ""}`}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
