-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" TEXT NOT NULL,
    "lesson_num" INTEGER NOT NULL,
    "arc_num" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hub_location" TEXT NOT NULL DEFAULT 'KHMP',
    "objectives" JSONB NOT NULL DEFAULT '[]',
    "brief_content" TEXT,
    "debrief_template" TEXT,
    "scoring_rubric" JSONB,
    "is_check_flight" BOOLEAN NOT NULL DEFAULT false,
    "check_flight_quiz_num" INTEGER,
    "flight_school_ready" BOOLEAN NOT NULL DEFAULT false,
    "ground_school_ready" BOOLEAN NOT NULL DEFAULT false,
    "quiz_ready" BOOLEAN NOT NULL DEFAULT false,
    "scoring_ready" BOOLEAN NOT NULL DEFAULT false,
    "media_ready" BOOLEAN NOT NULL DEFAULT false,
    "ground_school_production_notes" TEXT,
    "flight_rubric_production_notes" TEXT,
    "media_production_notes" TEXT,
    "scoring_tuning_notes" TEXT,
    "debrief_content" JSONB,
    "mental_model_outcome" TEXT,
    "mental_model_mantra" TEXT,
    "trigger_thresholds" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quizzes" (
    "id" TEXT NOT NULL,
    "quiz_num" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "questions" JSONB NOT NULL DEFAULT '[]',
    "required_score" INTEGER NOT NULL DEFAULT 80,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flight_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "csv_filename" TEXT NOT NULL,
    "cloud_storage_path" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "upload_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parsed_data" JSONB,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "duration_sec" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "flight_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempts" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "segment_type" TEXT NOT NULL,
    "start_time" DOUBLE PRECISION NOT NULL,
    "end_time" DOUBLE PRECISION NOT NULL,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "confidence" TEXT NOT NULL DEFAULT 'HIGH',

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scores" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "overall_score" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ground_school_content" (
    "id" TEXT NOT NULL,
    "lesson_num" INTEGER NOT NULL,
    "title" TEXT,
    "arc" INTEGER,
    "mode" TEXT,
    "student_level" TEXT,
    "workload_level" TEXT,
    "estimated_read_time_min" INTEGER,
    "acs_alignment" JSONB NOT NULL DEFAULT '[]',
    "rep_walkthrough_focus" JSONB NOT NULL DEFAULT '[]',
    "before_you_fly" JSONB NOT NULL DEFAULT '[]',
    "mission" JSONB NOT NULL DEFAULT '[]',
    "what_matters_today" JSONB NOT NULL DEFAULT '[]',
    "target_numbers" JSONB NOT NULL DEFAULT '{}',
    "simple_flight_flow" JSONB NOT NULL DEFAULT '[]',
    "common_mistakes" JSONB NOT NULL DEFAULT '[]',
    "do_not_worry_about_yet" JSONB NOT NULL DEFAULT '[]',
    "debrief_reveal" JSONB NOT NULL DEFAULT '[]',
    "cfi_notes" TEXT DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ground_school_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_seeds" (
    "id" TEXT NOT NULL,
    "lesson_num" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL DEFAULT '[]',
    "correct_index" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_seeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "lesson_num" INTEGER NOT NULL,
    "answers" JSONB NOT NULL DEFAULT '[]',
    "correct_count" INTEGER NOT NULL,
    "total_count" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_progress" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "flight_score" INTEGER,
    "quiz_passed" BOOLEAN NOT NULL DEFAULT false,
    "debrief_viewed" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'LOCKED',
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_session_token_key" ON "auth_sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_lesson_num_key" ON "lessons"("lesson_num");

-- CreateIndex
CREATE INDEX "lessons_arc_num_idx" ON "lessons"("arc_num");

-- CreateIndex
CREATE UNIQUE INDEX "quizzes_quiz_num_key" ON "quizzes"("quiz_num");

-- CreateIndex
CREATE INDEX "flight_sessions_user_id_idx" ON "flight_sessions"("user_id");

-- CreateIndex
CREATE INDEX "flight_sessions_lesson_id_idx" ON "flight_sessions"("lesson_id");

-- CreateIndex
CREATE INDEX "attempts_session_id_idx" ON "attempts"("session_id");

-- CreateIndex
CREATE INDEX "scores_session_id_idx" ON "scores"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "ground_school_content_lesson_num_key" ON "ground_school_content"("lesson_num");

-- CreateIndex
CREATE INDEX "quiz_seeds_lesson_num_idx" ON "quiz_seeds"("lesson_num");

-- CreateIndex
CREATE INDEX "quiz_attempts_user_id_lesson_num_idx" ON "quiz_attempts"("user_id", "lesson_num");

-- CreateIndex
CREATE INDEX "user_progress_user_id_idx" ON "user_progress"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_progress_user_id_lesson_id_key" ON "user_progress"("user_id", "lesson_id");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flight_sessions" ADD CONSTRAINT "flight_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flight_sessions" ADD CONSTRAINT "flight_sessions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "flight_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scores" ADD CONSTRAINT "scores_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "flight_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
