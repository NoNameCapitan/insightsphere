-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "specialty" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserRoleGrant" (
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("user_id", "role"),
    CONSTRAINT "UserRoleGrant_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" DATETIME NOT NULL,
    "last_seen_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" DATETIME,
    CONSTRAINT "AuthSession_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rnokpp" TEXT,
    "rnokpp_absence_reason" TEXT,
    "last_name" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "birth_date" TEXT NOT NULL,
    "rank" TEXT,
    "military_unit_or_tck" TEXT NOT NULL,
    "referral_number" TEXT,
    "referral_date" TEXT,
    "referral_issuer" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VlkSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patient_id" TEXT NOT NULL,
    "ticket_number" TEXT NOT NULL,
    "creation_key" TEXT NOT NULL,
    "session_date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REGISTERED',
    "commission_name" TEXT NOT NULL,
    "patient_snapshot" JSONB NOT NULL,
    "rank" TEXT,
    "military_unit_or_tck" TEXT NOT NULL,
    "referral_number" TEXT NOT NULL,
    "referral_date" TEXT NOT NULL,
    "referral_issuer" TEXT NOT NULL,
    "order_402_revision" TEXT NOT NULL,
    "order_402_column" TEXT,
    "order_402_article" TEXT,
    "fitness_category" TEXT,
    "final_diagnosis" TEXT,
    "final_decision" TEXT,
    "decision_date" TEXT,
    "protocol_number" TEXT,
    "reassessment_date" TEXT,
    "replaces_session_id" TEXT,
    "correction_reason" TEXT,
    "created_by_id" TEXT NOT NULL,
    "finalized_by_id" TEXT,
    "finalized_at" DATETIME,
    "cancelled_at" DATETIME,
    "cancellation_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "VlkSession_replaces_session_id_fkey" FOREIGN KEY ("replaces_session_id") REFERENCES "VlkSession" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT "VlkSession_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VlkSession_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VlkSession_finalized_by_id_fkey" FOREIGN KEY ("finalized_by_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SessionRequirement" (
    "session_id" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY ("session_id", "specialty"),
    CONSTRAINT "SessionRequirement_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "VlkSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MedicalExamination" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "complaints" TEXT NOT NULL DEFAULT '',
    "anamnesis" TEXT NOT NULL DEFAULT '',
    "objective_data" TEXT NOT NULL DEFAULT '',
    "icd10_code" TEXT,
    "icd10_version" TEXT,
    "diagnosis_text" TEXT NOT NULL DEFAULT '',
    "no_icd_reason" TEXT,
    "order_402_article" TEXT,
    "fitness_category" TEXT,
    "doctor_conclusion" TEXT NOT NULL DEFAULT '',
    "recommendations" TEXT NOT NULL DEFAULT '',
    "doctor_name_snapshot" TEXT NOT NULL,
    "examined_at" DATETIME,
    "completed_at" DATETIME,
    "void_reason" TEXT,
    "amendment_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "MedicalExamination_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "VlkSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MedicalExamination_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MedicalExamination_icd10_code_icd10_version_fkey" FOREIGN KEY ("icd10_code", "icd10_version") REFERENCES "Icd10Entry" ("code", "catalog_version") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdditionalDiagnosis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examination_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'COMORBIDITY',
    "icd10_code" TEXT NOT NULL,
    "icd10_version" TEXT NOT NULL,
    "diagnosis_text" TEXT NOT NULL,
    "order_402_article" TEXT,
    CONSTRAINT "AdditionalDiagnosis_examination_id_fkey" FOREIGN KEY ("examination_id") REFERENCES "MedicalExamination" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AdditionalDiagnosis_icd10_code_icd10_version_fkey" FOREIGN KEY ("icd10_code", "icd10_version") REFERENCES "Icd10Entry" ("code", "catalog_version") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Icd10Entry" (
    "code" TEXT NOT NULL,
    "catalog_version" TEXT NOT NULL,
    "title_uk" TEXT NOT NULL,
    "search_text" TEXT NOT NULL,
    "source_uri" TEXT NOT NULL,
    "source_sha256" TEXT NOT NULL,
    "is_selectable" BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY ("code", "catalog_version")
);

-- CreateTable
CREATE TABLE "VlkDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "document_number" TEXT NOT NULL,
    "template_version" TEXT NOT NULL,
    "template_source" TEXT NOT NULL,
    "payload_schema_version" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "payload_sha256" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VlkDocument_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "VlkSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VlkDocument_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "operator_id" TEXT NOT NULL,
    "request_key" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "synced_at" DATETIME,
    "external_record_id" TEXT,
    "transferred_fields" JSONB NOT NULL,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncLog_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "VlkSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SyncLog_document_id_session_id_fkey" FOREIGN KEY ("document_id", "session_id") REFERENCES "VlkDocument" ("id", "session_id") ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT "SyncLog_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actor_id" TEXT,
    "session_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "VlkSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_role_is_active_idx" ON "User"("role", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_token_hash_key" ON "AuthSession"("token_hash");

-- CreateIndex
CREATE INDEX "AuthSession_user_id_expires_at_idx" ON "AuthSession"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "AuthSession_expires_at_idx" ON "AuthSession"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_rnokpp_key" ON "Patient"("rnokpp");

-- CreateIndex
CREATE INDEX "Patient_last_name_first_name_birth_date_idx" ON "Patient"("last_name", "first_name", "birth_date");

-- CreateIndex
CREATE UNIQUE INDEX "VlkSession_ticket_number_key" ON "VlkSession"("ticket_number");

-- CreateIndex
CREATE UNIQUE INDEX "VlkSession_creation_key_key" ON "VlkSession"("creation_key");

-- CreateIndex
CREATE UNIQUE INDEX "VlkSession_replaces_session_id_key" ON "VlkSession"("replaces_session_id");

-- CreateIndex
CREATE INDEX "VlkSession_session_date_status_idx" ON "VlkSession"("session_date", "status");

-- CreateIndex
CREATE INDEX "VlkSession_patient_id_session_date_idx" ON "VlkSession"("patient_id", "session_date");

-- CreateIndex
CREATE INDEX "VlkSession_created_by_id_idx" ON "VlkSession"("created_by_id");

-- CreateIndex
CREATE INDEX "VlkSession_finalized_by_id_idx" ON "VlkSession"("finalized_by_id");

-- CreateIndex
CREATE INDEX "MedicalExamination_doctor_id_status_idx" ON "MedicalExamination"("doctor_id", "status");

-- CreateIndex
CREATE INDEX "MedicalExamination_icd10_code_icd10_version_idx" ON "MedicalExamination"("icd10_code", "icd10_version");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalExamination_session_id_specialty_revision_key" ON "MedicalExamination"("session_id", "specialty", "revision");

-- CreateIndex
CREATE INDEX "AdditionalDiagnosis_icd10_code_icd10_version_idx" ON "AdditionalDiagnosis"("icd10_code", "icd10_version");

-- CreateIndex
CREATE UNIQUE INDEX "AdditionalDiagnosis_examination_id_position_key" ON "AdditionalDiagnosis"("examination_id", "position");

-- CreateIndex
CREATE INDEX "Icd10Entry_catalog_version_is_selectable_idx" ON "Icd10Entry"("catalog_version", "is_selectable");

-- CreateIndex
CREATE INDEX "VlkDocument_created_by_id_idx" ON "VlkDocument"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "VlkDocument_session_id_kind_revision_key" ON "VlkDocument"("session_id", "kind", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "VlkDocument_id_session_id_key" ON "VlkDocument"("id", "session_id");

-- CreateIndex
CREATE UNIQUE INDEX "SyncLog_request_key_key" ON "SyncLog"("request_key");

-- CreateIndex
CREATE INDEX "SyncLog_session_id_created_at_idx" ON "SyncLog"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "SyncLog_document_id_created_at_idx" ON "SyncLog"("document_id", "created_at");

-- CreateIndex
CREATE INDEX "SyncLog_operator_id_created_at_idx" ON "SyncLog"("operator_id", "created_at");

-- CreateIndex
CREATE INDEX "AuditLog_session_id_created_at_idx" ON "AuditLog"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "AuditLog_actor_id_created_at_idx" ON "AuditLog"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "AuditLog_entity_type_entity_id_created_at_idx" ON "AuditLog"("entity_type", "entity_id", "created_at");

