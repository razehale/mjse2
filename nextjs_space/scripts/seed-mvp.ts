// ST-805B-MVP: Seed script to populate lesson records with Arc 1 content
// Reads arc1_content_manifest.json + lessons_v2.json + st806_arc1_debriefs.json
// and upserts lessons with debriefContent, mentalModelOutcome, mentalModelMantra, triggerThresholds
//
// Usage: npx tsx scripts/seed-mvp.ts

import * as fs from 'fs';
import * as path from 'path';

// Use dynamic import for Prisma to avoid client generation issues
async function main() {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  const dataDir = path.join(__dirname, '..', 'data');

  // Load Arc 1 content manifest
  const manifestPath = path.join(dataDir, 'arc1_content_manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const manifestLessons = manifest.lessons;

  // Load lessons_v2.json for mantras and metadata
  const lessonsV2Path = path.join(dataDir, 'lessons_v2.json');
  const lessonsV2 = JSON.parse(fs.readFileSync(lessonsV2Path, 'utf-8'));
  const v2Map: Record<number, any> = {};
  for (const l of lessonsV2.lessons) {
    v2Map[l.lessonNum] = l;
  }

  // Load debrief data
  const debriefPath = path.join(dataDir, 'st806_arc1_debriefs.json');
  const debriefData = JSON.parse(fs.readFileSync(debriefPath, 'utf-8'));
  const debriefMap: Record<number, any> = {};
  for (const entry of debriefData) {
    const num = parseInt(entry.lesson.replace('L', ''), 10);
    debriefMap[num] = entry.debrief;
  }

  console.log(`📦 Manifest: ${Object.keys(manifestLessons).length} lessons`);
  console.log(`📦 Lessons V2: ${Object.keys(v2Map).length} lessons`);
  console.log(`📦 Debriefs: ${Object.keys(debriefMap).length} entries`);
  console.log('');

  let upserted = 0;

  for (const [key, data] of Object.entries(manifestLessons) as [string, any][]) {
    const lessonNum = parseInt(key.replace('L', ''), 10);
    const v2 = v2Map[lessonNum] ?? {};
    const debrief806 = debriefMap[lessonNum];
    const manifestDebrief = data.debrief ?? {};

    // Build debriefContent from manifest (structured debrief for UI)
    const debriefContent = manifestDebrief.content ?? debrief806 ?? null;

    // Build brief content from manifest briefing
    const briefing = data.briefing?.student_view;
    let briefContent: string | null = null;
    if (briefing && typeof briefing === 'object') {
      const parts: string[] = [];
      if (briefing.objective) parts.push(`**Objective:** ${briefing.objective}`);
      if (briefing.must_do_actions?.length) {
        parts.push(`\n**Must-Do Actions:**`);
        for (const a of briefing.must_do_actions) parts.push(`- ${a}`);
      }
      if (briefing.target_numbers?.length) {
        parts.push(`\n**Target Numbers:**`);
        for (const t of briefing.target_numbers) parts.push(`- ${t}`);
      }
      briefContent = parts.join('\n');
    }

    // Build trigger thresholds from v2 or manifest
    const triggerThresholds = v2.triggerThresholds ?? null;

    // Determine arc
    const arcNum = data.arc ?? v2.arc ?? 1;

    // Build scoring rubric from manifest quiz/scoring
    const scoringRubric = data.quiz?.scoring ?? null;

    const updateData: any = {
      title: v2.lessonTitle ?? data.lesson_name ?? `Lesson ${lessonNum}`,
      arcNum,
      description: v2.description ?? data.lesson_name ?? '',
      debriefContent: debriefContent ? debriefContent : undefined,
      mentalModelOutcome: data.mentalModelOutcome ?? v2.mentalModelOutcome ?? null,
      mentalModelMantra: v2.mentalModelMantra ?? null,
      triggerThresholds: triggerThresholds,
      briefContent: briefContent,
      flightSchoolReady: arcNum <= 1,
      groundSchoolReady: arcNum <= 1,
      scoringReady: arcNum <= 1,
    };

    // Filter undefined values
    const filteredUpdate: any = {};
    for (const [k, v] of Object.entries(updateData)) {
      if (v !== undefined) filteredUpdate[k] = v;
    }

    await prisma.lesson.upsert({
      where: { lessonNum },
      update: filteredUpdate,
      create: {
        lessonNum,
        ...filteredUpdate,
      },
    });

    upserted++;
    const hasDebrief = debriefContent ? '✅' : '❌';
    const hasMantra = v2.mentalModelMantra ? '✅' : '—';
    const hasOutcome = (data.mentalModelOutcome || v2.mentalModelOutcome) ? '✅' : '—';
    console.log(`  L${lessonNum}: ${filteredUpdate.title} [debrief:${hasDebrief} mantra:${hasMantra} outcome:${hasOutcome}]`);
  }

  console.log(`\n✅ Seeded ${upserted} lessons`);
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Seed error:', e);
  process.exit(1);
});
