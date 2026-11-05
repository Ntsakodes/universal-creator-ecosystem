-- Business invariants are enforced in PostgreSQL as well as application validation.
ALTER TABLE "Asset" ADD CONSTRAINT asset_size CHECK (size > 0 AND size <= 26214400);
ALTER TABLE "Asset" ADD CONSTRAINT scanned_asset_complete CHECK (status <> 'READY' OR ("sha256" IS NOT NULL AND "objectVersion" IS NOT NULL));
ALTER TABLE "WorkVersion" ADD CONSTRAINT positive_version CHECK (number > 0);
ALTER TABLE "WorkVersion" ADD CONSTRAINT manifest_digest CHECK ("manifestHash" ~ '^[a-f0-9]{64}$');
ALTER TABLE "RightsRecord" ADD CONSTRAINT rights_share CHECK ("shareBasisPoints" IS NULL OR "shareBasisPoints" BETWEEN 0 AND 10000);
ALTER TABLE "RightsRecord" ADD CONSTRAINT rights_dates CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt");
ALTER TABLE "Campaign" ADD CONSTRAINT campaign_target CHECK ("targetMinor" BETWEEN 1 AND 100000000 AND currency='ZAR');
ALTER TABLE "Pledge" ADD CONSTRAINT pledge_amount CHECK ("amountMinor" BETWEEN 1 AND 10000000);
ALTER TABLE "Pledge" ADD CONSTRAINT pledge_kind CHECK (kind IN ('SUPPORTER','SPONSOR'));
ALTER TABLE "AiRun" ADD CONSTRAINT ai_status CHECK (status IN ('PENDING','COMPLETED','FAILED','CANCELLED'));
ALTER TABLE "Job" ADD CONSTRAINT job_status CHECK (state IN ('PENDING','RUNNING','DONE','FAILED'));
ALTER TABLE "Job" ADD CONSTRAINT job_kind CHECK (kind IN ('SCAN','AI'));

CREATE FUNCTION uce_reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'This evidence record is append-only'; END;
$$;
CREATE TRIGGER immutable_work_versions BEFORE UPDATE OR DELETE ON "WorkVersion" FOR EACH ROW EXECUTE FUNCTION uce_reject_mutation();
CREATE TRIGGER immutable_version_assets BEFORE UPDATE OR DELETE ON "VersionAsset" FOR EACH ROW EXECUTE FUNCTION uce_reject_mutation();
CREATE TRIGGER immutable_review_reports BEFORE UPDATE OR DELETE ON "ReviewReport" FOR EACH ROW EXECUTE FUNCTION uce_reject_mutation();
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION uce_reject_mutation();
CREATE TRIGGER immutable_rights_records BEFORE UPDATE OR DELETE ON "RightsRecord" FOR EACH ROW EXECUTE FUNCTION uce_reject_mutation();
CREATE TRIGGER immutable_ready_assets BEFORE UPDATE OR DELETE ON "Asset" FOR EACH ROW WHEN (OLD.status = 'READY'::"ScanStatus") EXECUTE FUNCTION uce_reject_mutation();

CREATE FUNCTION uce_check_evidence_asset() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_work uuid; evidence_work uuid; evidence_status "ScanStatus";
BEGIN
  SELECT "workId",status INTO evidence_work,evidence_status FROM "Asset" WHERE id=NEW."assetId";
  SELECT "workId" INTO target_work FROM "WorkVersion" WHERE id=NEW."versionId";
  IF evidence_work IS DISTINCT FROM target_work OR evidence_status IS DISTINCT FROM 'READY'::"ScanStatus" THEN
    RAISE EXCEPTION 'Evidence must be scanned and belong to the same work';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER same_work_evidence BEFORE INSERT ON "VersionAsset" FOR EACH ROW EXECUTE FUNCTION uce_check_evidence_asset();

CREATE FUNCTION uce_check_agreement() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Asset" WHERE id=NEW."agreementAssetId" AND "workId"=NEW."workId" AND status='READY') THEN
    RAISE EXCEPTION 'Supporting agreement must be scanned and belong to the same work';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER valid_agreement BEFORE INSERT ON "RightsRecord" FOR EACH ROW EXECUTE FUNCTION uce_check_agreement();
