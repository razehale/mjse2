// ST-500: Seed script for S2S backbone
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding S2S database...');

  // Seed admin account
  const adminHash = await bcrypt.hash('S2SA123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@s2s.com' },
    update: { passwordHash: adminHash, role: 'ADMIN', name: 'S2S Admin' },
    create: { email: 'admin@s2s.com', passwordHash: adminHash, role: 'ADMIN', name: 'S2S Admin' },
  });
  console.log('Admin account seeded: admin@s2s.com');

  // Seed test account
  const testHash = await bcrypt.hash('johndoe123', 10);
  await prisma.user.upsert({
    where: { email: 'john@doe.com' },
    update: { passwordHash: testHash, role: 'ADMIN', name: 'Test Admin' },
    create: { email: 'john@doe.com', passwordHash: testHash, role: 'ADMIN', name: 'Test Admin' },
  });

  // Seed 17 lessons
  const lessons = [
    // Arc 1: Mechanical Intimacy
    {
      lessonNum: 1, arcNum: 1,
      title: 'Long Walk',
      description: 'High-speed taxi and your first circuit at KHMP. Learn the physical relationship between throttle, rudder, and the runway centerline.',
      objectives: ['Complete high-speed taxi without departing centerline', 'Execute first takeoff reaching Vr (55 kts)', 'Fly one traffic pattern at 1,000 ft AGL', 'Land on Runway 24 (any quality)'],
      briefContent: 'Welcome to your first flight. Today we\'re going to feel the airplane before we fly it. Start with a high-speed taxi down Runway 24—keep it under 40 knots, feel the rudder come alive. Then we\'ll do one full circuit: takeoff, crosswind, downwind at 90 knots, base, final at 65 knots, and land. Don\'t worry about perfection. Feel the machine.',
      debriefTemplate: 'Review: Centerline tracking during taxi, rotation speed at liftoff, pattern altitude maintenance, approach speed stability.',
      scoringRubric: { focuses: ['rotation_speed', 'climb_speed', 'pattern_altitude', 'approach_speed'] },
      flightSchoolReady: true, groundSchoolReady: true, quizReady: true, scoringReady: true, mediaReady: false,
      groundSchoolProductionNotes: 'Need ground school video on C172 cockpit familiarization',
      flightRubricProductionNotes: 'Scoring tuned for Arc 1 basics - Vr/Vy/pattern/approach',
      mediaProductionNotes: 'Need cockpit tour video, taxi demonstration',
      scoringTuningNotes: 'Tolerances set wide for first lesson',
    },
    {
      lessonNum: 2, arcNum: 1,
      title: 'Configurator',
      description: 'Learn the go-around: the most critical landing skill. Fly GLGL: 2 go-arounds + 2 landings.',
      objectives: ['Execute 2 full go-around cycles with proper POWER, PITCH, CLEAN, CLIMB, REJOIN procedure', 'Recognize unstable approach at ~100 feet AGL and decide to go around', 'Demonstrate 2 stable landings (65 KIAS ±5, centered, smooth descent)', 'Master decision-making: when to land vs. when to go around'],
      briefContent: 'The go-around is not a failure. It\'s a decision. Most landing accidents happen because pilots force bad approaches. Today you\'ll practice GLGL: Go-Around, Land, Go-Around, Land. At ~100 feet on final, you\'ll assess: stable approach = land, unstable = go around. When you go around: full throttle, pitch up, carb heat off, retract flaps to 20°, climb at Vy (74 KIAS), rejoin downwind. Let\'s build the habit.',
      debriefTemplate: 'Review: Go-around execution (POWER/PITCH/CLEAN/CLIMB/REJOIN), decision-making at 100 feet AGL, stability assessment, landing consistency.',
      scoringRubric: { focuses: ['go_around_execution', 'decision_making', 'approach_stability', 'landing_consistency'] },
      flightSchoolReady: true, groundSchoolReady: true, quizReady: true, scoringReady: true, mediaReady: false,
      groundSchoolProductionNotes: 'GLGL doctrine complete with mental model, triggers, and step-by-step procedure.',
      flightRubricProductionNotes: 'Go-around detection and scoring engine built (go_around.ts). Tracks 4 GLGL events per flight.',
      mediaProductionNotes: 'Need go-around demonstration video',
      scoringTuningNotes: 'GLGL pass criteria: 2+ go-arounds, 2+ landings, ≥2 of 4 events ≥4, no safety failures.',
    },
    {
      lessonNum: 3, arcNum: 1,
      title: 'Edge of Envelope',
      description: 'Explore slow flight, stalls, and steep turns. Learn what the airplane tells you before it bites.',
      objectives: ['Perform power-on stall with recovery', 'Perform power-off stall with recovery', 'Execute 45° bank steep turns (360°)', 'Complete pre-flight walk-around checklist'],
      briefContent: 'We\'re going to find the edges today. Slow flight first—fly at minimum controllable airspeed, feel the mushiness. Then stalls: the horn, the buffet, the break, the recovery. Finally steep turns at 45° bank. And before any of this, you\'ll do your first proper walk-around.',
      debriefTemplate: 'Review: Stall recognition and recovery technique, steep turn altitude maintenance, walk-around completeness.',
      scoringRubric: { focuses: ['stall_recovery', 'steep_turns', 'walk_around'] },
      flightSchoolReady: true, groundSchoolReady: true, quizReady: true, scoringReady: false, mediaReady: false,
      groundSchoolProductionNotes: 'Need aerodynamics of stall, load factor in turns',
      flightRubricProductionNotes: 'TODO: Stall detection from telemetry (stall_warn + pitch/airspeed)',
      mediaProductionNotes: 'Need stall demonstration video',
      scoringTuningNotes: 'TODO: Define stall recovery scoring criteria',
    },
    {
      lessonNum: 4, arcNum: 1,
      title: 'Arc 1 Check Flight',
      description: 'Demonstrate mechanical intimacy. Five touch-and-goes plus one emergency landing on Runway 06. Quiz 250 required.',
      objectives: ['Pass Quiz 250 (Arc 1 knowledge)', 'Execute 5 touch-and-goes with consistent technique', 'Handle simulated engine failure to Runway 06', 'Score 3+ on all grading criteria'],
      briefContent: 'This is your first check ride. Five touch-and-goes on Runway 24, then I\'ll pull the engine on you for an emergency landing on Runway 06. Show me you know this airplane.',
      debriefTemplate: 'Check flight evaluation: T&G consistency, emergency procedures, overall airmanship.',
      scoringRubric: { focuses: ['consistency', 'emergency_landing', 'airmanship'] },
      isCheckFlight: true, checkFlightQuizNum: 250,
      flightSchoolReady: true, groundSchoolReady: true, quizReady: true, scoringReady: false, mediaReady: false,
      groundSchoolProductionNotes: 'Check flight - ground school is quiz-based',
      flightRubricProductionNotes: 'TODO: Consistency scoring across multiple T&Gs',
      mediaProductionNotes: 'Need check flight briefing video',
      scoringTuningNotes: 'Must pass all criteria at 3+ to advance to Arc 2',
    },
    // Arc 2: Pattern Master
    {
      lessonNum: 5, arcNum: 2,
      title: 'The Box',
      description: 'Perfect the rectangular traffic pattern. Every turn on a geographic fix, every altitude on the number.',
      objectives: ['TODO: Define learning objectives'],
      briefContent: 'Content to be produced by curriculum specialist.',
      flightSchoolReady: false, groundSchoolReady: false, quizReady: false, scoringReady: false, mediaReady: false,
      groundSchoolProductionNotes: 'Awaiting content development',
      flightRubricProductionNotes: 'Awaiting content development',
      mediaProductionNotes: 'Awaiting content development',
      scoringTuningNotes: 'Awaiting content development',
    },
    {
      lessonNum: 6, arcNum: 2,
      title: 'Wind Whisperer',
      description: 'Crosswind operations. Crab angles, wing-low technique, and maintaining centerline in gusty conditions.',
      objectives: ['TODO: Define learning objectives'],
      briefContent: 'Content to be produced by curriculum specialist.',
      flightSchoolReady: false, groundSchoolReady: false, quizReady: false, scoringReady: false, mediaReady: false,
      groundSchoolProductionNotes: 'Awaiting content development',
      flightRubricProductionNotes: 'Awaiting content development',
      mediaProductionNotes: 'Awaiting content development',
      scoringTuningNotes: 'Awaiting content development',
    },
    {
      lessonNum: 7, arcNum: 2,
      title: 'Arc 2 Check Flight',
      description: 'Demonstrate pattern mastery under various conditions. Quiz 251 required.',
      objectives: ['TODO: Define learning objectives'],
      briefContent: 'Content to be produced by curriculum specialist.',
      isCheckFlight: true, checkFlightQuizNum: 251,
      flightSchoolReady: false, groundSchoolReady: false, quizReady: true, scoringReady: false, mediaReady: false,
      groundSchoolProductionNotes: 'Awaiting content development',
      flightRubricProductionNotes: 'Awaiting content development',
      mediaProductionNotes: 'Awaiting content development',
      scoringTuningNotes: 'Awaiting content development',
    },
    // Arc 3: Departure Protocols
    {
      lessonNum: 8, arcNum: 3,
      title: 'Breaking Free',
      description: 'First departure from KHMP pattern. Straight-out and 45° departures, altitude management.',
      objectives: ['TODO: Define learning objectives'],
      briefContent: 'Content to be produced by curriculum specialist.',
      flightSchoolReady: false, groundSchoolReady: false, quizReady: false, scoringReady: false, mediaReady: false,
      groundSchoolProductionNotes: 'Awaiting content development',
      flightRubricProductionNotes: 'Awaiting content development',
      mediaProductionNotes: 'Awaiting content development',
      scoringTuningNotes: 'Awaiting content development',
    },
    {
      lessonNum: 9, arcNum: 3,
      title: 'Compass Rose',
      description: 'Navigation fundamentals. VOR tracking, pilotage, dead reckoning basics.',
      objectives: ['TODO: Define learning objectives'],
      briefContent: 'Content to be produced by curriculum specialist.',
      flightSchoolReady: false, groundSchoolReady: false, quizReady: false, scoringReady: false, mediaReady: false,
      groundSchoolProductionNotes: 'Awaiting content development',
      flightRubricProductionNotes: 'Awaiting content development',
      mediaProductionNotes: 'Awaiting content development',
      scoringTuningNotes: 'Awaiting content development',
    },
    {
      lessonNum: 10, arcNum: 3,
      title: 'Arc 3 Check Flight',
      description: 'Demonstrate departure and basic navigation competency. Quiz 252 required.',
      objectives: ['TODO: Define learning objectives'],
      briefContent: 'Content to be produced by curriculum specialist.',
      isCheckFlight: true, checkFlightQuizNum: 252,
      flightSchoolReady: false, groundSchoolReady: false, quizReady: true, scoringReady: false, mediaReady: false,
      groundSchoolProductionNotes: 'Awaiting content development',
      flightRubricProductionNotes: 'Awaiting content development',
      mediaProductionNotes: 'Awaiting content development',
      scoringTuningNotes: 'Awaiting content development',
    },
    // Arc 4: Emergency & Elements
    {
      lessonNum: 11, arcNum: 4,
      title: 'Dead Stick',
      description: 'Engine failure procedures. Best glide speed, field selection, emergency checklists.',
      objectives: ['TODO: Define learning objectives'],
      briefContent: 'Content to be produced by curriculum specialist.',
      flightSchoolReady: false, groundSchoolReady: false, quizReady: false, scoringReady: false, mediaReady: false,
      groundSchoolProductionNotes: 'Awaiting content development',
      flightRubricProductionNotes: 'Awaiting content development',
      mediaProductionNotes: 'Awaiting content development',
      scoringTuningNotes: 'Awaiting content development',
    },
    {
      lessonNum: 12, arcNum: 4,
      title: 'Weather Wise',
      description: 'Flying in weather. Cloud avoidance, visibility management, go/no-go decisions.',
      objectives: ['TODO: Define learning objectives'],
      briefContent: 'Content to be produced by curriculum specialist.',
      flightSchoolReady: false, groundSchoolReady: false, quizReady: false, scoringReady: false, mediaReady: false,
      groundSchoolProductionNotes: 'Awaiting content development',
      flightRubricProductionNotes: 'Awaiting content development',
      mediaProductionNotes: 'Awaiting content development',
      scoringTuningNotes: 'Awaiting content development',
    },
    {
      lessonNum: 13, arcNum: 4,
      title: 'Night Owl',
      description: 'Night flying fundamentals. Instrument scan, lighting, spatial disorientation awareness.',
      objectives: ['TODO: Define learning objectives'],
      briefContent: 'Content to be produced by curriculum specialist.',
      flightSchoolReady: false, groundSchoolReady: false, quizReady: false, scoringReady: false, mediaReady: false,
      groundSchoolProductionNotes: 'Awaiting content development',
      flightRubricProductionNotes: 'Awaiting content development',
      mediaProductionNotes: 'Awaiting content development',
      scoringTuningNotes: 'Awaiting content development',
    },
    {
      lessonNum: 14, arcNum: 4,
      title: 'Arc 4 Check Flight',
      description: 'Demonstrate emergency handling and adverse condition competency. Quiz 253 required.',
      objectives: ['TODO: Define learning objectives'],
      briefContent: 'Content to be produced by curriculum specialist.',
      isCheckFlight: true, checkFlightQuizNum: 253,
      flightSchoolReady: false, groundSchoolReady: false, quizReady: true, scoringReady: false, mediaReady: false,
      groundSchoolProductionNotes: 'Awaiting content development',
      flightRubricProductionNotes: 'Awaiting content development',
      mediaProductionNotes: 'Awaiting content development',
      scoringTuningNotes: 'Awaiting content development',
    },
    // Arc 5: Cross-Country Solo
    {
      lessonNum: 15, arcNum: 5,
      title: 'Flight Plan',
      description: 'Cross-country flight planning. Weight and balance, fuel calculations, route selection.',
      objectives: ['TODO: Define learning objectives'],
      briefContent: 'Content to be produced by curriculum specialist.',
      flightSchoolReady: false, groundSchoolReady: false, quizReady: false, scoringReady: false, mediaReady: false,
      groundSchoolProductionNotes: 'Awaiting content development',
      flightRubricProductionNotes: 'Awaiting content development',
      mediaProductionNotes: 'Awaiting content development',
      scoringTuningNotes: 'Awaiting content development',
    },
    {
      lessonNum: 16, arcNum: 5,
      title: 'Dual Cross-Country',
      description: 'Instructor-guided cross-country flight. Checkpoint navigation, diversion procedures.',
      objectives: ['TODO: Define learning objectives'],
      briefContent: 'Content to be produced by curriculum specialist.',
      flightSchoolReady: false, groundSchoolReady: false, quizReady: false, scoringReady: false, mediaReady: false,
      groundSchoolProductionNotes: 'Awaiting content development',
      flightRubricProductionNotes: 'Awaiting content development',
      mediaProductionNotes: 'Awaiting content development',
      scoringTuningNotes: 'Awaiting content development',
    },
    {
      lessonNum: 17, arcNum: 5,
      title: 'Solo Cross-Country',
      description: 'Your solo cross-country flight. Plan it, fly it, own it.',
      objectives: ['TODO: Define learning objectives'],
      briefContent: 'Content to be produced by curriculum specialist.',
      flightSchoolReady: false, groundSchoolReady: false, quizReady: false, scoringReady: false, mediaReady: false,
      groundSchoolProductionNotes: 'Awaiting content development',
      flightRubricProductionNotes: 'Awaiting content development',
      mediaProductionNotes: 'Awaiting content development',
      scoringTuningNotes: 'Awaiting content development',
    },
  ];

  for (const lesson of lessons) {
    await prisma.lesson.upsert({
      where: { lessonNum: lesson.lessonNum },
      update: {
        arcNum: lesson.arcNum,
        title: lesson.title,
        description: lesson.description,
        objectives: lesson.objectives,
        briefContent: lesson.briefContent ?? null,
        debriefTemplate: lesson.debriefTemplate ?? null,
        scoringRubric: (lesson.scoringRubric as any) ?? undefined,
        isCheckFlight: lesson.isCheckFlight ?? false,
        checkFlightQuizNum: lesson.checkFlightQuizNum ?? null,
        flightSchoolReady: lesson.flightSchoolReady,
        groundSchoolReady: lesson.groundSchoolReady,
        quizReady: lesson.quizReady,
        scoringReady: lesson.scoringReady,
        mediaReady: lesson.mediaReady,
        groundSchoolProductionNotes: lesson.groundSchoolProductionNotes ?? null,
        flightRubricProductionNotes: lesson.flightRubricProductionNotes ?? null,
        mediaProductionNotes: lesson.mediaProductionNotes ?? null,
        scoringTuningNotes: lesson.scoringTuningNotes ?? null,
      },
      create: {
        lessonNum: lesson.lessonNum,
        arcNum: lesson.arcNum,
        title: lesson.title,
        description: lesson.description,
        objectives: lesson.objectives,
        briefContent: lesson.briefContent ?? null,
        debriefTemplate: lesson.debriefTemplate ?? null,
        scoringRubric: (lesson.scoringRubric as any) ?? undefined,
        isCheckFlight: lesson.isCheckFlight ?? false,
        checkFlightQuizNum: lesson.checkFlightQuizNum ?? null,
        flightSchoolReady: lesson.flightSchoolReady,
        groundSchoolReady: lesson.groundSchoolReady,
        quizReady: lesson.quizReady,
        scoringReady: lesson.scoringReady,
        mediaReady: lesson.mediaReady,
        groundSchoolProductionNotes: lesson.groundSchoolProductionNotes ?? null,
        flightRubricProductionNotes: lesson.flightRubricProductionNotes ?? null,
        mediaProductionNotes: lesson.mediaProductionNotes ?? null,
        scoringTuningNotes: lesson.scoringTuningNotes ?? null,
      },
    });
  }
  console.log('17 lessons seeded');

  // Seed 4 check flight quizzes
  const quizzes = [
    {
      quizNum: 250,
      title: 'Arc 1 Check: Mechanical Intimacy',
      requiredScore: 80,
      questions: [
        {
          question: 'What is the rotation speed (Vr) for a Cessna 172?',
          options: ['45 knots', '55 knots', '65 knots', '75 knots'],
          correctIndex: 1,
          explanation: 'Vr for the C172 is 55 knots indicated airspeed.',
        },
        {
          question: 'What is the best rate of climb speed (Vy) for a Cessna 172?',
          options: ['64 knots', '74 knots', '84 knots', '94 knots'],
          correctIndex: 1,
          explanation: 'Vy for the C172 is 74 knots indicated airspeed.',
        },
        {
          question: 'What is the standard traffic pattern altitude at KHMP?',
          options: ['882 ft MSL', '1,000 ft MSL', '1,882 ft MSL', '2,882 ft MSL'],
          correctIndex: 2,
          explanation: 'KHMP field elevation is 882 ft MSL. Pattern altitude is 1,000 ft AGL = 1,882 ft MSL.',
        },
        {
          question: 'What is the standard approach speed for a Cessna 172?',
          options: ['55 knots', '60 knots', '65 knots', '75 knots'],
          correctIndex: 2,
          explanation: 'Standard approach speed for the C172 is 65 knots indicated.',
        },
        {
          question: 'During an engine failure at pattern altitude, what speed should you immediately target?',
          options: ['55 knots (Vr)', '65 knots (Vapproach)', '68 knots (Vglide)', '74 knots (Vy)'],
          correctIndex: 2,
          explanation: 'Best glide speed of 68 knots maximizes your glide distance to reach a landing site.',
        },
      ],
    },
    {
      quizNum: 251,
      title: 'Arc 2 Check: Pattern Master',
      requiredScore: 80,
      questions: [
        {
          question: 'TODO: Pattern geometry question',
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctIndex: 0,
          explanation: 'TODO: Awaiting content specialist.',
        },
        {
          question: 'TODO: Crosswind technique question',
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctIndex: 0,
          explanation: 'TODO: Awaiting content specialist.',
        },
      ],
    },
    {
      quizNum: 252,
      title: 'Arc 3 Check: Departure Protocols',
      requiredScore: 80,
      questions: [
        {
          question: 'TODO: Navigation question',
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctIndex: 0,
          explanation: 'TODO: Awaiting content specialist.',
        },
        {
          question: 'TODO: Departure procedure question',
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctIndex: 0,
          explanation: 'TODO: Awaiting content specialist.',
        },
      ],
    },
    {
      quizNum: 253,
      title: 'Arc 4 Check: Emergency & Elements',
      requiredScore: 80,
      questions: [
        {
          question: 'TODO: Emergency procedures question',
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctIndex: 0,
          explanation: 'TODO: Awaiting content specialist.',
        },
        {
          question: 'TODO: Weather decision-making question',
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctIndex: 0,
          explanation: 'TODO: Awaiting content specialist.',
        },
      ],
    },
  ];

  for (const quiz of quizzes) {
    await prisma.quiz.upsert({
      where: { quizNum: quiz.quizNum },
      update: { title: quiz.title, questions: quiz.questions, requiredScore: quiz.requiredScore },
      create: { quizNum: quiz.quizNum, title: quiz.title, questions: quiz.questions, requiredScore: quiz.requiredScore },
    });
  }
  console.log('4 quizzes seeded');

  console.log('Seeding complete!');
}

main()
  .catch((e: any) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
