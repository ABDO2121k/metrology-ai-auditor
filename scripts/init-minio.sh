#!/bin/sh
# =========================================================
# MINIO S3 BUCKET AUTOMATED INITIALIZER SCRIPT
# =========================================================

echo "Initializing MinIO Object Storage Buckets..."

# Configure mc alias for local MinIO server
/usr/bin/mc alias set myminio http://minio:9000 minio_admin MinioSecretPassword123!

# Create buckets if they do not exist
echo "Creating bucket: metrology-certificates"
/usr/bin/mc mb myminio/metrology-certificates --ignore-existing

echo "Creating bucket: audit-reports"
/usr/bin/mc mb myminio/audit-reports --ignore-existing

# Set download policy for certificates bucket
/usr/bin/mc anonymous set download myminio/metrology-certificates

echo "MinIO buckets initialized successfully!"
exit 0
