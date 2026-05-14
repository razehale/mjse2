'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileUp, Check, AlertCircle, Loader2, Clock, Gauge, Mountain } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FlightTabProps {
  lesson: any;
  sessions: any[];
  onUpload: () => void;
}

export function FlightTab({ lesson, sessions, onUpload }: FlightTabProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [machadoQuizPct, setMachadoQuizPct] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lessons that require Machado quiz input
  const needsQuiz = lesson?.lessonNum === 2 || lesson?.lessonNum === 4;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e?.target?.files?.[0];
    if (!file) return;

    // If lesson needs quiz and no score entered yet, hold file and prompt
    if (needsQuiz && !machadoQuizPct) {
      setPendingFile(file);
      return;
    }

    await processUpload(file);
  };

  const processUpload = async (file: File) => {
    setUploading(true);
    setError('');
    setUploadResult(null);
    setPendingFile(null);

    try {
      // Read CSV content
      const csvContent = await file.text();

      // Upload to S3 via presigned URL
      let cloudStoragePath: string | null = null;
      try {
        const presignRes = await fetch('/api/upload/presigned', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file?.name, contentType: 'text/csv', isPublic: false }),
        });
        if (presignRes?.ok) {
          const { uploadUrl, cloud_storage_path } = await presignRes.json();
          const url = new URL(uploadUrl);
          const signedHeaders = url?.searchParams?.get?.('X-Amz-SignedHeaders') ?? '';
          const headers: Record<string, string> = { 'Content-Type': 'text/csv' };
          if (signedHeaders?.includes?.('content-disposition')) {
            headers['Content-Disposition'] = 'attachment';
          }
          await fetch(uploadUrl, { method: 'PUT', headers, body: file });
          cloudStoragePath = cloud_storage_path;
        }
      } catch (s3Err: any) {
        console.error('S3 upload failed, continuing with direct parse:', s3Err);
      }

      // Build payload — include machado quiz if applicable
      const payload: any = {
        lessonId: lesson?.id,
        csvContent,
        csvFilename: file?.name ?? 'upload.csv',
        cloudStoragePath,
      };
      if (needsQuiz && machadoQuizPct) {
        payload.machadoQuizPct = parseFloat(machadoQuizPct);
      }

      // Create session with parsed telemetry
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res?.ok) {
        const data = await res?.json?.();
        throw new Error(data?.error ?? 'Upload failed');
      }

      const result = await res.json();
      setUploadResult(result);
      onUpload?.();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to upload telemetry');
    } finally {
      setUploading(false);
      if (fileInputRef?.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Map numeric score to grade label
  const gradeLabel = (score: number): string => {
    if (score >= 4.5) return 'Nailed it';
    if (score >= 3.5) return 'Sharp';
    if (score >= 2.5) return 'Solid';
    if (score >= 1.5) return 'Developing';
    return 'Rough';
  };

  const gradeColor = (score: number): string => {
    if (score >= 4.5) return 'text-emerald-400';
    if (score >= 3.5) return 'text-sky-400';
    if (score >= 2.5) return 'text-[#60B5FF]';
    if (score >= 1.5) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-6">
      {/* Machado Quiz Input — only for L2 / L4 */}
      {needsQuiz && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30"
        >
          <p className="text-sm font-semibold text-amber-300 mb-1">📝 Machado Quiz Required</p>
          <p className="text-xs text-muted-foreground mb-3">
            Enter your Rod Machado quiz score before uploading. Need ≥ 80% to pass.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={100}
              placeholder="Score %"
              value={machadoQuizPct}
              onChange={(e) => setMachadoQuizPct(e.target.value)}
              className="w-28 px-3 py-2 rounded-lg bg-background border border-border text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
            <span className="text-xs text-muted-foreground">%</span>
            {machadoQuizPct && parseFloat(machadoQuizPct) >= 80 && (
              <Check className="w-4 h-4 text-emerald-400" />
            )}
            {machadoQuizPct && parseFloat(machadoQuizPct) < 80 && parseFloat(machadoQuizPct) > 0 && (
              <span className="text-xs text-red-400">Below 80% — review and retake</span>
            )}
          </div>
        </motion.div>
      )}

      {/* Pending file prompt — user picked a file but hasn't entered quiz score */}
      {pendingFile && needsQuiz && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/30"
        >
          <p className="text-sm text-sky-300 font-semibold mb-1">CSV Ready: {pendingFile.name}</p>
          <p className="text-xs text-muted-foreground mb-3">
            Enter your Machado quiz percentage above, then click Process.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!machadoQuizPct || parseFloat(machadoQuizPct) <= 0}
              onClick={() => processUpload(pendingFile)}
            >
              Process Upload
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setPendingFile(null); if (fileInputRef?.current) fileInputRef.current.value = ''; }}
            >
              Cancel
            </Button>
          </div>
        </motion.div>
      )}

      {/* Upload area */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-8 rounded-xl bg-card/30 border-2 border-dashed border-border/50 text-center"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
          id="csv-upload"
        />

        {uploading ? (
          <div>
            <Loader2 className="w-10 h-10 text-[#60B5FF] animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground mt-3">Processing telemetry data...</p>
          </div>
        ) : uploadResult ? (
          <div>
            <Check className="w-10 h-10 text-emerald-400 mx-auto" />
            <p className="text-sm text-white font-semibold mt-3">Telemetry Uploaded!</p>
            <div className="flex justify-center gap-6 mt-4">
              <div className="text-center">
                <p className={`text-2xl font-mono font-bold ${gradeColor(uploadResult?.score?.overallScore ?? 0)}`}>
                  {uploadResult?.score?.overallScore ?? '-'}/5
                </p>
                <p className={`text-xs font-semibold mt-0.5 ${gradeColor(uploadResult?.score?.overallScore ?? 0)}`}>
                  {gradeLabel(uploadResult?.score?.overallScore ?? 0)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Flight Score</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-mono text-muted-foreground">{uploadResult?.rowCount ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">Data Points</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-mono text-muted-foreground">{uploadResult?.phases ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">Phases</p>
              </div>
            </div>
            {uploadResult?.score?.overallScore >= 3 && (
              <p className="text-xs text-emerald-400 mt-3">✓ Flight passed — proceed to debrief</p>
            )}
            {uploadResult?.score?.overallScore > 0 && uploadResult?.score?.overallScore < 3 && (
              <p className="text-xs text-amber-400 mt-3">Score below 3 — re-fly the lesson and upload again</p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => { setUploadResult(null); }}
            >
              Upload Another
            </Button>
          </div>
        ) : (
          <label htmlFor="csv-upload" className="cursor-pointer block">
            <FileUp className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="text-sm text-white font-semibold mt-3">Upload Telemetry CSV</p>
            <p className="text-xs text-muted-foreground mt-1">
              Drop your FlyWithLua recorder CSV file here
            </p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <span>Choose File</span>
            </Button>
          </label>
        )}

        {error && (
          <div className="flex items-center justify-center gap-2 mt-3 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs">{error}</span>
          </div>
        )}
      </motion.div>

      {/* Previous sessions */}
      {(sessions?.length ?? 0) > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="text-sm font-semibold text-white mb-3">Previous Sessions</h3>
          <div className="space-y-2">
            {(sessions ?? []).map((s: any, idx: number) => (
              <div
                key={s?.id ?? idx}
                className="flex items-center gap-3 p-3 rounded-lg bg-card/30 border border-border/30"
              >
                <Upload className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-white truncate">{s?.csvFilename ?? 'session.csv'}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(s?.uploadTimestamp ?? 0).toLocaleDateString?.() ?? 'Unknown'}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {Math.round(s?.durationSec ?? 0)}s
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Gauge className="w-3 h-3" />
                    {s?.rowCount ?? 0} pts
                  </div>
                  {(s?.scores?.length ?? 0) > 0 && (
                    <span className="font-mono font-bold text-[#60B5FF]">
                      {s?.scores?.[0]?.overallScore ?? '-'}/5
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
