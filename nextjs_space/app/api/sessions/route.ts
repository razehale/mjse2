export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { evaluateFlight, loadTelemetry, col } from '@/lib/s2s-engine';

// POST: Create a new flight session from CSV upload
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { lessonId, csvContent, csvFilename, cloudStoragePath, machadoQuizPct } = body ?? {};

    if (!lessonId || !csvContent) {
      return NextResponse.json({ error: 'lessonId and csvContent are required' }, { status: 400 });
    }

    const userId = (session?.user as any)?.id;
    const userEmail = (session?.user as any)?.email ?? 'unknown';

    // Get lesson for lessonNum
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    const lessonKey = `L${lesson.lessonNum}`;

    // Run the S2S Scoring Engine
    const { result, json: debriefJson, html: debriefHtml } = evaluateFlight(
      csvContent,
      lessonKey,
      csvFilename ?? 'upload.csv',
      {
        studentId: userEmail,
        machadoQuizPct: machadoQuizPct != null ? Number(machadoQuizPct) : undefined,
      },
    );

    // Store summary data for charts (sampled rows from raw parse)
    const { dataframe: df } = loadTelemetry(csvContent, 1.0);
    const tArr = col(df, 't');
    const sampledRows: Record<string, number>[] = [];
    // Sample every 5th row for chart display
    for (let i = 0; i < df.length; i += 5) {
      const row: Record<string, number> = {};
      for (const c of df.columns) {
        row[c] = df.data[c]?.[i] ?? 0;
      }
      sampledRows.push(row);
    }

    const summaryData: any = {
      debriefJson,
      debriefHtml,
      sampledRows,
      rowCount: df.length,
      durationSec: tArr.length > 0 ? (tArr[tArr.length - 1] - tArr[0]) : 0,
    };

    // START ST-802D Logic — lift L2 GLGL to top-level parsedData for easier UI access
    if (result.extras?.l2_glgl) {
      summaryData.l2_glgl = result.extras.l2_glgl;
    }
    // END ST-802D Logic

    // Create flight session
    const flightSession = await prisma.flightSession.create({
      data: {
        userId,
        lessonId,
        csvFilename: csvFilename ?? 'upload.csv',
        cloudStoragePath: cloudStoragePath ?? null,
        isPublic: false,
        rowCount: df.length,
        durationSec: summaryData.durationSec,
        parsedData: summaryData as any,
      },
    });

    // Create attempts from phases
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

    // Create score record
    const overallScoreInt = Math.max(1, Math.min(5, Math.round(result.overallScore)));
    await prisma.score.create({
      data: {
        sessionId: flightSession.id,
        overallScore: overallScoreInt,
        breakdown: debriefJson as any,
      },
    });

    // START ST-802D Logic — L2 must also pass GLGL conditions, not just numeric score
    const flightOk = result.passed; // result.passed encodes all pass requirements (incl. L2 GLGL)
    const newStatus = flightOk ? 'NEEDS_DEBRIEF' : (overallScoreInt >= 3 ? 'IN_PROGRESS' : 'IN_PROGRESS');
    // END ST-802D Logic

    // Update user progress
    await prisma.userProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: {
        flightScore: overallScoreInt,
        status: newStatus,
      },
      create: {
        userId,
        lessonId,
        flightScore: overallScoreInt,
        status: newStatus,
      },
    });

    return NextResponse.json({
      sessionId: flightSession?.id,
      score: {
        overallScore: result.overallScore,
        overallGrade: result.overallGrade,
        passed: result.passed,
        coachingNotes: result.coachingBullets,
      },
      phases: result.phases.length,
      rowCount: df.length,
      durationSec: summaryData.durationSec,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Session create error:', error);
    return NextResponse.json({ error: 'Failed to process telemetry', details: error?.message }, { status: 500 });
  }
}
