package config

import (
	"context"
	"log"
	"os"

	"github.com/redis/go-redis/v9"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var (
	DB          *gorm.DB
	RedisClient *redis.Client
	JWTSecret   string
)

func InitConfig() {
	JWTSecret = os.Getenv("JWT_SECRET")
	if JWTSecret == "" {
		JWTSecret = "SuperSecretJwtKey2026ProcessInstruments!"
	}

	dsn := os.Getenv("POSTGRES_DSN")
	if dsn == "" {
		dsn = "postgres://metrology_admin:SecretPassword123!@localhost:5432/metrology_db?sslmode=disable"
	}

	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to PostgreSQL: %v", err)
	}

	log.Println("PostgreSQL connection established successfully.")

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://:RedisSecret123!@localhost:6379/0"
	}

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatalf("Failed to parse Redis URL: %v", err)
	}

	RedisClient = redis.NewClient(opt)
	if err := RedisClient.Ping(context.Background()).Err(); err != nil {
		log.Printf("Warning: Redis Ping failed: %v", err)
	} else {
		log.Println("Redis connection established successfully.")
	}
}
