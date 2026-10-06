# Vortex One Files & Documents

PostgreSQL stores tenant-scoped metadata; a private Supabase Storage bucket stores binary content. Object keys are tenant-prefixed as <organization_id>/<entity_type>/<entity_id>/<file_id>.<ext>.

API:
- GET /api/files?q=&category=&entityType=&entityId=
- POST /api/files/upload-url
- POST /api/files/:id/finalize
- GET /api/files/:id/download-url
- DELETE /api/files/:id (admin/executive/manager)

The service never trusts a client-supplied organization ID for authorization, never exposes the service-role key, and returns only short-lived signed upload/download URLs. Large recordings should use Supabase resumable/TUS uploads rather than proxying the binary through Express.

Environment:
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
VORTEX_FILES_BUCKET=vortex-files
VORTEX_FILES_MAX_BYTES=524288000
VORTEX_FILES_UPLOAD_EXPIRY_SECONDS=7200
VORTEX_FILES_DOWNLOAD_EXPIRY_SECONDS=300

Future integrations: attach files to properties/owners/calls, persist transcripts, OCR documents into extracted_text, malware scan before AI ingestion, and create export/import file records.
