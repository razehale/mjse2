// START ST-802D Logic — Quiz Seed + Attempt helpers
import { prisma } from '@/lib/prisma';

export async function getQuizSeeds(lessonNum: number) {
  return prisma.quizSeed.findMany({
    where: { lessonNum },
    orderBy: { createdAt: 'asc' },
  });
}

export async function hasQuizSeeds(lessonNum: number): Promise<boolean> {
  const count = await prisma.quizSeed.count({ where: { lessonNum } });
  return count > 0;
}

export async function submitQuizAttempt(
  userId: string,
  lessonNum: number,
  answers: number[],
) {
  const seeds = await getQuizSeeds(lessonNum);
  if (seeds.length === 0) throw new Error('No quiz questions found for this lesson.');

  let correctCount = 0;
  const results = seeds.map((seed, i) => {
    const userAnswer = answers[i] ?? -1;
    const isCorrect = userAnswer === seed.correctIndex;
    if (isCorrect) correctCount++;
    return {
      question: seed.question,
      options: seed.options,
      correctIndex: seed.correctIndex,
      userAnswer,
      isCorrect,
      explanation: seed.explanation,
    };
  });

  // Arc 1 passing threshold: 4 out of 5
  const totalCount = seeds.length;
  const requiredCorrect = Math.max(1, totalCount - 1); // 4/5 for Arc 1
  const passed = correctCount >= requiredCorrect;

  // Store the attempt
  const attempt = await prisma.quizAttempt.create({
    data: {
      userId,
      lessonNum,
      answers,
      correctCount,
      totalCount,
      passed,
    },
  });

  return {
    attemptId: attempt.id,
    correctCount,
    totalCount,
    passed,
    results,
  };
}
// END ST-802D Logic
