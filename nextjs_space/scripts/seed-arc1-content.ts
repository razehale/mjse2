// START ST-802B Logic — Arc 1 Ground School + Quiz Seed Script
// Updated ST-805B — Now also seeds debriefContent from st806_arc1_debriefs.json
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function seedArc1Content() {
  // Load ground school JSON from data directory
  const jsonPath = path.join(__dirname, '..', 'data', 'S2S_Academic_Agent_Master_Syllabus.json');
  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const syllabusData = JSON.parse(raw);

  const arc1Lessons = syllabusData.arc1DetailedContent;
  if (!arc1Lessons) {
    console.error('No arc1DetailedContent found in JSON.');
    process.exit(1);
  }

  // START ST-805B Logic — Load debrief content
  const debriefPath = path.join(__dirname, '..', 'data', 'st806_arc1_debriefs.json');
  let debriefMap: Record<number, any> = {};
  if (fs.existsSync(debriefPath)) {
    const debriefRaw = fs.readFileSync(debriefPath, 'utf-8');
    const debriefData = JSON.parse(debriefRaw);
    for (const entry of debriefData) {
      const lessonNum = parseInt(entry.lesson.replace('L', ''), 10);
      debriefMap[lessonNum] = entry.debrief;
    }
    console.log(`Loaded ${Object.keys(debriefMap).length} debrief entries from st806_arc1_debriefs.json`);
  } else {
    console.warn('st806_arc1_debriefs.json not found — skipping debrief seeding');
  }

  // Load lessons_v2.json for mental model fields
  const lessonsV2Path = path.join(__dirname, '..', 'data', 'lessons_v2.json');
  let lessonsV2Map: Record<number, any> = {};
  if (fs.existsSync(lessonsV2Path)) {
    const lessonsV2Raw = fs.readFileSync(lessonsV2Path, 'utf-8');
    const lessonsV2Data = JSON.parse(lessonsV2Raw);
    for (const lesson of lessonsV2Data.lessons) {
      lessonsV2Map[lesson.lessonNum] = lesson;
    }
    console.log(`Loaded ${Object.keys(lessonsV2Map).length} lesson entries from lessons_v2.json`);
  } else {
    console.warn('lessons_v2.json not found — skipping mental model field seeding');
  }
  // END ST-805B Logic

  let groundSchoolCount = 0;
  let quizCount = 0;
  let debriefCount = 0;

  for (const lessonData of Object.values(arc1Lessons) as any[]) {
    const { quizSeeds = [], ...gsData } = lessonData;

    // Upsert GroundSchoolContent by lessonNum
    await prisma.groundSchoolContent.upsert({
      where: { lessonNum: gsData.lessonNum },
      update: {
        title: gsData.title ?? null,
        arc: gsData.arc ?? null,
        mode: gsData.mode ?? null,
        studentLevel: gsData.studentLevel ?? null,
        workloadLevel: gsData.workloadLevel ?? null,
        estimatedReadTimeMin: gsData.estimatedReadTimeMin ?? null,
        acsAlignment: gsData.acsAlignment ?? [],
        repWalkthroughFocus: gsData.repWalkthroughFocus ?? [],
        beforeYouFly: gsData.beforeYouFly ?? [],
        mission: gsData.mission ?? [],
        whatMattersToday: gsData.whatMattersToday ?? [],
        targetNumbers: gsData.targetNumbers ?? {},
        simpleFlightFlow: gsData.simpleFlightFlow ?? [],
        commonMistakes: gsData.commonMistakes ?? [],
        doNotWorryAboutYet: gsData.doNotWorryAboutYet ?? [],
        debriefReveal: gsData.debriefReveal ?? [],
        // START ST-963 Logic — CFI Notes placeholder
        cfiNotes: gsData.cfiNotes ?? '[CFI MILES: INSERT COACHING]',
        // END ST-963 Logic
      },
      create: {
        lessonNum: gsData.lessonNum,
        title: gsData.title ?? null,
        arc: gsData.arc ?? null,
        mode: gsData.mode ?? null,
        studentLevel: gsData.studentLevel ?? null,
        workloadLevel: gsData.workloadLevel ?? null,
        estimatedReadTimeMin: gsData.estimatedReadTimeMin ?? null,
        acsAlignment: gsData.acsAlignment ?? [],
        repWalkthroughFocus: gsData.repWalkthroughFocus ?? [],
        beforeYouFly: gsData.beforeYouFly ?? [],
        mission: gsData.mission ?? [],
        whatMattersToday: gsData.whatMattersToday ?? [],
        targetNumbers: gsData.targetNumbers ?? {},
        simpleFlightFlow: gsData.simpleFlightFlow ?? [],
        commonMistakes: gsData.commonMistakes ?? [],
        doNotWorryAboutYet: gsData.doNotWorryAboutYet ?? [],
        debriefReveal: gsData.debriefReveal ?? [],
        // START ST-963 Logic — CFI Notes placeholder
        cfiNotes: gsData.cfiNotes ?? '[CFI MILES: INSERT COACHING]',
        // END ST-963 Logic
      },
    });
    groundSchoolCount += 1;
    console.log(`  ✓ GroundSchoolContent L${gsData.lessonNum}: ${gsData.title}`);

    // Delete existing QuizSeed rows for this lesson, then re-create
    await prisma.quizSeed.deleteMany({
      where: { lessonNum: gsData.lessonNum },
    });

    for (const quiz of quizSeeds) {
      await prisma.quizSeed.create({
        data: {
          lessonNum: gsData.lessonNum,
          question: quiz.question,
          options: quiz.options,
          correctIndex: quiz.correctIndex,
          explanation: quiz.explanation,
        },
      });
      quizCount += 1;
    }
    console.log(`  ✓ QuizSeed L${gsData.lessonNum}: ${quizSeeds.length} questions`);

    // START ST-805B Logic — Seed debriefContent and mental model fields on Lesson
    const debriefContent = debriefMap[gsData.lessonNum];
    const lessonV2 = lessonsV2Map[gsData.lessonNum];
    if (debriefContent || lessonV2) {
      const updateData: any = {};
      if (debriefContent) {
        updateData.debriefContent = debriefContent;
        debriefCount += 1;
      }
      if (lessonV2) {
        updateData.mentalModelOutcome = lessonV2.mentalModelOutcome ?? null;
        updateData.mentalModelMantra = lessonV2.mentalModelMantra ?? null;
        // Build trigger thresholds as human-readable string
        const thresholds = lessonV2.trigger_thresholds ?? {};
        const thresholdDescriptions: string[] = [];
        for (const [tname, tdata] of Object.entries(thresholds) as [string, any][]) {
          const desc = tdata.description ?? tname;
          thresholdDescriptions.push(`${tname}: ${desc}`);
        }
        updateData.triggerThresholds = thresholdDescriptions.length > 0
          ? thresholdDescriptions.join('; ')
          : null;
      }
      await prisma.lesson.updateMany({
        where: { lessonNum: gsData.lessonNum },
        data: updateData,
      });
      console.log(`  ✓ ST-805B fields L${gsData.lessonNum}: debrief=${!!debriefContent}, mentalModel=${!!lessonV2}`);
    }
    // END ST-805B Logic
  }

  console.log(`\n=== Seed Complete ===`);
  console.log(`Ground School records: ${groundSchoolCount}`);
  console.log(`Quiz Seed records: ${quizCount}`);
  console.log(`Debrief Content records: ${debriefCount}`);

  // Also set groundSchoolReady and quizReady flags on lessons 1-4
  for (let ln = 1; ln <= 4; ln++) {
    await prisma.lesson.updateMany({
      where: { lessonNum: ln },
      data: { groundSchoolReady: true, quizReady: true },
    });
  }
  console.log('Updated readiness flags for L1-L4.');
}

seedArc1Content()
  .catch((error) => {
    console.error('Seed error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
// END ST-802B Logic
