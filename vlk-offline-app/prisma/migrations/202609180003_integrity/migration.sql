-- Незмінність підтверджених медичних даних, документів і аудиту.
CREATE TRIGGER "session_closed" BEFORE UPDATE ON "VlkSession"
WHEN OLD.status IN ('FINALIZED','CANCELLED')
BEGIN SELECT RAISE(ABORT,'Closed session is immutable'); END;
CREATE TRIGGER "session_no_delete" BEFORE DELETE ON "VlkSession"
BEGIN SELECT RAISE(ABORT,'Clinical history cannot be deleted'); END;
CREATE TRIGGER "exam_closed_update" BEFORE UPDATE ON "MedicalExamination"
WHEN OLD.status <> 'DRAFT' OR NEW.session_id <> OLD.session_id OR NEW.doctor_id <> OLD.doctor_id OR NEW.specialty <> OLD.specialty OR (SELECT status FROM "VlkSession" WHERE id=OLD.session_id) IN ('FINALIZED','CANCELLED')
BEGIN SELECT RAISE(ABORT,'Confirmed examination is immutable'); END;
CREATE TRIGGER "exam_closed_insert" BEFORE INSERT ON "MedicalExamination"
WHEN (SELECT status FROM "VlkSession" WHERE id=NEW.session_id) IN ('FINALIZED','CANCELLED')
BEGIN SELECT RAISE(ABORT,'Session is closed'); END;
CREATE TRIGGER "exam_no_delete" BEFORE DELETE ON "MedicalExamination"
BEGIN SELECT RAISE(ABORT,'Clinical history cannot be deleted'); END;
CREATE TRIGGER "additional_closed_insert" BEFORE INSERT ON "AdditionalDiagnosis"
WHEN (SELECT status FROM "MedicalExamination" WHERE id=NEW.examination_id) <> 'DRAFT' OR (SELECT s.status FROM "MedicalExamination" e JOIN "VlkSession" s ON s.id=e.session_id WHERE e.id=NEW.examination_id) IN ('FINALIZED','CANCELLED')
BEGIN SELECT RAISE(ABORT,'Confirmed diagnoses are immutable'); END;
CREATE TRIGGER "additional_closed_update" BEFORE UPDATE ON "AdditionalDiagnosis"
WHEN NEW.examination_id <> OLD.examination_id OR (SELECT status FROM "MedicalExamination" WHERE id=OLD.examination_id) <> 'DRAFT' OR (SELECT s.status FROM "MedicalExamination" e JOIN "VlkSession" s ON s.id=e.session_id WHERE e.id=OLD.examination_id) IN ('FINALIZED','CANCELLED')
BEGIN SELECT RAISE(ABORT,'Confirmed diagnoses are immutable'); END;
CREATE TRIGGER "additional_closed_delete" BEFORE DELETE ON "AdditionalDiagnosis"
WHEN (SELECT status FROM "MedicalExamination" WHERE id=OLD.examination_id) <> 'DRAFT' OR (SELECT s.status FROM "MedicalExamination" e JOIN "VlkSession" s ON s.id=e.session_id WHERE e.id=OLD.examination_id) IN ('FINALIZED','CANCELLED')
BEGIN SELECT RAISE(ABORT,'Confirmed diagnoses are immutable'); END;
CREATE TRIGGER "document_no_update" BEFORE UPDATE ON "VlkDocument" BEGIN SELECT RAISE(ABORT,'Document is immutable'); END;
CREATE TRIGGER "document_no_delete" BEFORE DELETE ON "VlkDocument" BEGIN SELECT RAISE(ABORT,'Document is immutable'); END;
CREATE TRIGGER "audit_no_update" BEFORE UPDATE ON "AuditLog" BEGIN SELECT RAISE(ABORT,'Audit is append-only'); END;
CREATE TRIGGER "audit_no_delete" BEFORE DELETE ON "AuditLog" BEGIN SELECT RAISE(ABORT,'Audit is append-only'); END;
CREATE TRIGGER "transfer_no_update" BEFORE UPDATE ON "SyncLog" BEGIN SELECT RAISE(ABORT,'Transfer log is append-only'); END;
CREATE TRIGGER "transfer_no_delete" BEFORE DELETE ON "SyncLog" BEGIN SELECT RAISE(ABORT,'Transfer log is append-only'); END;
CREATE TRIGGER "icd_pair_insert" BEFORE INSERT ON "MedicalExamination"
WHEN (NEW.icd10_code IS NULL) <> (NEW.icd10_version IS NULL)
BEGIN SELECT RAISE(ABORT,'Code and catalog version must both be set'); END;
CREATE TRIGGER "icd_pair_update" BEFORE UPDATE ON "MedicalExamination"
WHEN (NEW.icd10_code IS NULL) <> (NEW.icd10_version IS NULL)
BEGIN SELECT RAISE(ABORT,'Code and catalog version must both be set'); END;
