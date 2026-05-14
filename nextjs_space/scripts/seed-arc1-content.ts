// START ST-802B Logic — Arc 1 Ground School + Quiz Seed Script
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function seedArc1Content() {
  // Load JSON from data directory
  const jsonPath = path.join(__dirname, '..', 'data', 'S2S_Academic_Agent_Master_Syllabus.json');
  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const syllabusData = JSON.parse(raw);

  const arc1Lessons = syllabusData.arc1DetailedContent;
  if (!arc1Lessons) {
    console.error('No arc1DetailedContent found in JSON.');
    process.exit(1);
  }

  let groundSchoolCount = 0;
  let quizCount = 0;

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
  }

  console.log(`\n=== Seed Complete ===`);
  console.log(`Ground School records: ${groundSchoolCount}`);
  console.log(`Quiz Seed records: ${quizCount}`);

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
