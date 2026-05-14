// ST-501: Lesson and progress types

export interface LessonData {
  id: string;
  lessonNum: number;
  arcNum: number;
  title: string;
  description: string;
  hubLocation: string;
  objectives: string[];
  briefContent: string | null;
  debriefTemplate: string | null;
  scoringRubric: any;
  isCheckFlight: boolean;
  checkFlightQuizNum: number | null;
  flightSchoolReady: boolean;
  groundSchoolReady: boolean;
  quizReady: boolean;
  scoringReady: boolean;
  mediaReady: boolean;
  groundSchoolProductionNotes: string | null;
  flightRubricProductionNotes: string | null;
  mediaProductionNotes: string | null;
  scoringTuningNotes: string | null;
}

export interface UserProgressData {
  id: string;
  userId: string;
  lessonId: string;
  flightScore: number | null;
  quizPassed: boolean;
  debriefViewed: boolean;
  status: LessonStatus;
  completedAt: string | null;
}

export type LessonStatus =
  | 'LOCKED'
  | 'AVAILABLE'
  | 'IN_PROGRESS'
  | 'NEEDS_GROUND_SCHOOL'
  | 'NEEDS_FLIGHT'
  | 'NEEDS_DEBRIEF'
  | 'PASSED'
  | 'PLACEHOLDER';

export interface ScoreBreakdown {
  rotationSpeed?: { score: number; actual: number; target: number };
  climbSpeed?: { score: number; actual: number; target: number };
  patternAltitude?: { score: number; actual: number; target: number };
  approachSpeed?: { score: number; actual: number; target: number };
  coordination?: { score: number; value: number };
  controlTechnique?: { score: number; smoothness: number };
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export const ARC_NAMES: Record<number, string> = {
  1: 'Mechanical Intimacy',
  2: 'Pattern Master',
  3: 'Departure Protocols',
  4: 'Emergency & Elements',
  5: 'Cross-Country Solo',
};

export const ARC_COLORS: Record<number, string> = {
  1: '#60B5FF',
  2: '#80D8C3',
  3: '#FF9149',
  4: '#FF6363',
  5: '#A19AD3',
};
