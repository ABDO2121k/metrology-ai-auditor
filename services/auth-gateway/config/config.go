package config

import (
	"context"
	"log"
	"os"

	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"auth-gateway/models"
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

	// Auto-Migrate Schemas
	if err := DB.AutoMigrate(&models.User{}); err != nil {
		log.Printf("Warning: GORM AutoMigrate failed: %v", err)
	}

	// Seed Default Root Admin Account
	seedDefaultAdmin()

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

func seedDefaultAdmin() {
	adminUsername := os.Getenv("DEFAULT_ADMIN_USERNAME")
	if adminUsername == "" {
		adminUsername = "admin"
	}

	adminPassword := os.Getenv("DEFAULT_ADMIN_PASSWORD")
	if adminPassword == "" {
		adminPassword = "AdminSecret123!"
	}

	var existingUser models.User
	if err := DB.Where("username = ?", adminUsername).First(&existingUser).Error; err == nil {
		log.Printf("Root admin account '%s' already exists.", adminUsername)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("Failed to hash default admin password: %v", err)
		return
	}

	adminUser := models.User{
		Username:     adminUsername,
		Email:        adminUsername + "@process-instruments.com",
		PasswordHash: string(hash),
		FullName:     "System Root Administrator",
		Role:         models.RoleAdministrator,
		IsActive:     true,
	}

	if err := DB.Create(&adminUser).Error; err != nil {
		log.Printf("Failed to seed default admin user: %v", err)
	} else {
		log.Printf("Root admin account '%s' provisioned successfully from environment configuration.", adminUsername)
	}
}
