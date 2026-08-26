package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"strings"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/redis/go-redis/v9"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var (
	DB          *gorm.DB
	RedisClient *redis.Client
	MinIOClient *minio.Client
	BucketName  string
)

func InitServices() {
	// 1. PostgreSQL DB Connection
	dsn := os.Getenv("POSTGRES_DSN")
	if dsn == "" {
		dsn = "postgres://metrology_admin:SecretPassword123!@localhost:5432/metrology_db?sslmode=disable"
	}

	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to PostgreSQL: %v", err)
	}
	log.Println("Document Ingestion: Connected to PostgreSQL.")

	// 2. Redis Connection
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://:RedisSecret123!@localhost:6379/0"
	}

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatalf("Failed to parse Redis URL: %v", err)
	}
	RedisClient = redis.NewClient(opt)
	log.Println("Document Ingestion: Connected to Redis.")

	// 3. MinIO S3 Client Connection
	endpoint := os.Getenv("MINIO_ENDPOINT")
	if endpoint == "" {
		endpoint = "localhost:9000"
	}
	accessKey := os.Getenv("MINIO_ACCESS_KEY")
	if accessKey == "" {
		accessKey = "minio_admin"
	}
	secretKey := os.Getenv("MINIO_SECRET_KEY")
	if secretKey == "" {
		secretKey = "MinioSecretPassword123!"
	}
	BucketName = os.Getenv("MINIO_BUCKET")
	if BucketName == "" {
		BucketName = "metrology-certificates"
	}

	useSSL := false
	MinIOClient, err = minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		log.Fatalf("Failed to connect to MinIO: %v", err)
	}

	// Ensure Bucket Exists
	ctx := context.Background()
	exists, errBucket := MinIOClient.BucketExists(ctx, BucketName)
	if errBucket != nil {
		log.Printf("MinIO Bucket check warning: %v", errBucket)
	} else if !exists {
		errMake := MinIOClient.MakeBucket(ctx, BucketName, minio.MakeBucketOptions{})
		if errMake != nil {
			log.Printf("Failed to create MinIO bucket %s: %v", BucketName, errMake)
		} else {
			log.Printf("Created MinIO bucket: %s", BucketName)
		}
	}
	log.Println("Document Ingestion: MinIO Client ready.")
}

func UploadToMinIO(ctx context.Context, objectName string, reader io.Reader, objectSize int64) (string, error) {
	info, err := MinIOClient.PutObject(ctx, BucketName, objectName, reader, objectSize, minio.PutObjectOptions{
		ContentType: "application/pdf",
	})
	if err != nil {
		return "", err
	}
	s3Path := fmt.Sprintf("%s/%s", BucketName, info.Key)
	return s3Path, nil
}

// DeleteFromMinIO deletes an object given an s3Path returned by UploadToMinIO (format: "bucket/key...")
func DeleteFromMinIO(ctx context.Context, s3Path string) error {
	if s3Path == "" {
		return nil
	}
	// Normalize and extract object key
	normalized := s3Path
	// If path contains bucket prefix, remove it
	if strings.HasPrefix(normalized, BucketName+"/") {
		normalized = strings.TrimPrefix(normalized, BucketName+"/")
	}
	if strings.HasPrefix(normalized, "/") {
		normalized = strings.TrimPrefix(normalized, "/")
	}
	if normalized == "" {
		return nil
	}
	err := MinIOClient.RemoveObject(ctx, BucketName, normalized, minio.RemoveObjectOptions{})
	return err
}


// ObjectKeyFromS3Path strips the bucket prefix that UploadToMinIO adds, so the
// stored path round-trips back to a key the SDK accepts.
func ObjectKeyFromS3Path(s3Path string) string {
	key := strings.TrimPrefix(s3Path, BucketName+"/")
	return strings.TrimPrefix(key, "/")
}

// OpenFromMinIO streams an object back. The caller closes the reader.
func OpenFromMinIO(ctx context.Context, s3Path string) (*minio.Object, minio.ObjectInfo, error) {
	key := ObjectKeyFromS3Path(s3Path)
	if key == "" {
		return nil, minio.ObjectInfo{}, fmt.Errorf("empty object key")
	}

	obj, err := MinIOClient.GetObject(ctx, BucketName, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, minio.ObjectInfo{}, err
	}

	// GetObject is lazy: it does not contact the server until the object is
	// read or stat'd, so a missing key would otherwise surface as a truncated
	// 200 rather than a 404.
	info, err := obj.Stat()
	if err != nil {
		obj.Close()
		return nil, minio.ObjectInfo{}, err
	}
	return obj, info, nil
}

func PublishEvent(channel string, payload map[string]interface{}) {
	ctx := context.Background()
	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Failed to marshal event payload: %v", err)
		return
	}
	if err := RedisClient.Publish(ctx, channel, string(jsonBytes)).Err(); err != nil {
		log.Printf("Failed to publish event to Redis channel %s: %v", channel, err)
	} else {
		log.Printf("Published event to Redis channel '%s'", channel)
	}
}
