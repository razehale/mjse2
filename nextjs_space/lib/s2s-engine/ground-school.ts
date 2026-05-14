// START ST-802C Logic — Ground School content helper
import { prisma } from '@/lib/prisma';

export async function getGroundSchoolContent(lessonNum: number) {
  return prisma.groundSchoolContent.findUnique({
    where: { lessonNum },
  });
}
// END ST-802C Logic
