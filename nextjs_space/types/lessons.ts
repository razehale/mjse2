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
  // START ST-805B Logic — Mental model + debrief fields
  debriefContent: DebriefContent | null;
  mentalModelOutcome: string | null;
  mentalModelMantra: string | null;
  triggerThresholds: string | null;
  // END ST-805B Logic
}

// START ST-805B Logic — Debrief content structure
export interface DebriefContent {
  summary: string;
  what_you_did_well: string[];
  what_to_fix: string[];
  coach_callouts: string[];
  next_focus: string;
}

export interface DebriefEntry {
  lesson: string;
  title: string;
  mentalModel: string;
  debrief: DebriefContent;
}
// END ST-805B Logic

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
