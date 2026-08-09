package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"

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
