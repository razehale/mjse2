// ST-805B-MVP: Dedicated upload endpoint for V5 CSV telemetry
// Accepts multipart FormData OR JSON body
// Returns JSON with score + full debrief structure (never HTML page)
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { evaluateFlight, loadTelemetry, col } from '@/lib/s2s-engine';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session?.user as any)?.id;
    const userEmail = (session?.user as any)?.email ?? 'unknown';

    let csvContent: string;
    let csvFilename: string;
    let lessonNum: number;
    let machadoQuizPct: number | undefined;

    // Support both FormData (multipart) and JSON body
    const contentType = req.headers.get('content-type') ?? '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No CSV file provided' }, { status: 400 });
      }
      csvContent = await file.text();
      csvFilename = file.name ?? 'upload.csv';
      lessonNum = parseInt(formData.get('lessonNum') as string ?? '0', 10);
      const quizPct = formData.get('machadoQuizPct') as string | null;
      if (quizPct) machadoQuizPct = parseFloat(quizPct);
    } else {
      const body = await req.json();
      csvContent = body.csvContent;
      csvFilename = body.csvFilename ?? 'upload.csv';
      lessonNum = parseInt(body.lessonNum ?? '0', 10);
      if (body.machadoQuizPct != null) machadoQuizPct = Number(body.machadoQuizPct);
    }

    if (!csvContent || !lessonNum) {
      return NextResponse.json({ error: 'csvContent/file and lessonNum are required' }, { status: 400 });
    }

    // Find lesson by lessonNum
    const lesson = await prisma.lesson.findUnique({ where: { lessonNum } });
    if (!lesson) {
      return NextResponse.json({ error: `Lesson ${lessonNum} not found` }, { status: 404 });
    }

    const lessonKey = `L${lesson.lessonNum}`;

    // Run the S2S Scoring Engine
    const { result, json: debriefJson, html: debriefHtml } = evaluateFlight(
      csvContent,
      lessonKey,
      csvFilename,
      {
        studentId: userEmail,
        machadoQuizPct,
      },
    );

    // Sample telemetry for charts (every 5th row)
    const df = loadTelemetry(csvContent, 1.0);
    const tArr = col(df, 't');
    const sampledRows: Record<string, number>[] = [];
    for (let i = 0; i < df.length; i += 5) {
      const row: Record<string, number> = {};
      for (const c of df.columns) {
        row[c] = df.data[c]?.[i] ?? 0;
      }
      sampledRows.push(row);
    }

    const durationSec = tArr.length > 0 ? (tArr[tArr.length - 1] - tArr[0]) : 0;
    const summaryData: any = {
      debriefJson,
      debriefHtml,
      sampledRows,
      rowCount: df.length,
      durationSec,
    };

    // Lift L2 GLGL data if present
    if (result.extras?.l2_glgl) {
      summaryData.l2_glgl = result.extras.l2_glgl;
    }

    // Persist flight session
    const flightSession = await prisma.flightSession.create({
      data: {
        userId,
        lessonId: lesson.id,
        csvFilename,
        isPublic: false,
        rowCount: df.length,
        durationSec,
        parsedData: summaryData as any,
      },
    });

    // Persist phase attempts
    for (const phase of result.phases) {
      await prisma.attempt.create({
        data: {
          sessionId: flightSession.id,
          segmentType: phase.phase.toUpperCase(),
          startTime: phase.startT,
          endTime: phase.endT,
          metrics: { score: phase.score, grade: phase.grade, metricCount: phase.metrics.length },
          confidence: 'HIGH',
        },
      });
    }

    // Persist score
    const overallScoreInt = Math.max(1, Math.min(5, Math.round(result.overallScore)));
    await prisma.score.create({
      data: {
        sessionId: flightSession.id,
        overallScore: overallScoreInt,
        breakdown: debriefJson as any,
      },
    });

    // Update user progress with gate status
    const flightOk = result.passed;
    const newStatus = flightOk ? 'NEEDS_DEBRIEF' : 'IN_PROGRESS';

    await prisma.userProgress.upsert({
      where: { userId_lessonId: { userId, lessonId: lesson.id } },
      update: {
        flightScore: overallScoreInt,
        status: newStatus,
      },
      create: {
        userId,
        lessonId: lesson.id,
        flightScore: overallScoreInt,
        status: newStatus,
      },
    });

    // Return full JSON response (never HTML)
    return NextResponse.json({
      sessionId: flightSession.id,
      lessonNum: lesson.lessonNum,
      lessonKey,
      score: {
        overallScore: result.overallScore,
        overallScoreInt,
        overallGrade: result.overallGrade,
        passed: result.passed,
        coachingNotes: result.coachingBullets,
      },
      debrief: debriefJson,
      phases: result.phases.map(p => ({
        phase: p.phase,
        score: p.score,
        grade: p.grade,
        startT: p.startT,
        endT: p.endT,
        metrics: p.metrics,
      })),
      rowCount: df.length,
      durationSec,
      gateStatus: {
        flightScore: overallScoreInt,
        flightPassed: flightOk,
        requiresDebrief: true,
        status: newStatus,
      },
    }, { status: 201 });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process telemetry', details: error?.message },
      { status: 500 },
    );
  }
}
