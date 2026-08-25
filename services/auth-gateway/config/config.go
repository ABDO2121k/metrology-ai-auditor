package config

import (
	"fmt"
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
	var err error

	// Load POSTGRES_DSN directly or construct from environment variables
	dsn := os.Getenv("POSTGRES_DSN")
	if dsn == "" {
		dbHost := os.Getenv("DB_HOST")
		if dbHost == "" {
			dbHost = os.Getenv("POSTGRES_HOST")
		}
		if dbHost == "" {
			dbHost = "postgres"
		}

		dbUser := os.Getenv("DB_USER")
		if dbUser == "" {
			dbUser = os.Getenv("POSTGRES_USER")
		}
		if dbUser == "" {
			dbUser = "metrology_admin"
		}

		dbPassword := os.Getenv("DB_PASSWORD")
		if dbPassword == "" {
			dbPassword = os.Getenv("POSTGRES_PASSWORD")
		}
		if dbPassword == "" {
			dbPassword = "SecretPassword123!"
		}

		dbName := os.Getenv("DB_NAME")
		if dbName == "" {
			dbName = os.Getenv("POSTGRES_DB")
		}
		if dbName == "" {
			dbName = "metrology_db"
		}

		dbPort := os.Getenv("DB_PORT")
		if dbPort == "" {
			dbPort = os.Getenv("POSTGRES_PORT")
		}
		if dbPort == "" {
			dbPort = "5432"
		}

		dsn = fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=UTC",
			dbHost, dbUser, dbPassword, dbName, dbPort)
	}

	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to PostgreSQL database: %v", err)
	}

	// AutoMigrate models
	err = DB.AutoMigrate(&models.User{})
	if err != nil {
		log.Printf("GORM AutoMigrate warning: %v", err)
	}

	// Load Redis connection configuration
	redisURL := os.Getenv("REDIS_URL")
	if redisURL != "" {
		opt, err := redis.ParseURL(redisURL)
		if err == nil {
			RedisClient = redis.NewClient(opt)
		}
	}

	if RedisClient == nil {
		redisHost := os.Getenv("REDIS_HOST")
		redisPort := os.Getenv("REDIS_PORT")
		if redisHost == "" {
			redisHost = "redis"
		}
		if redisPort == "" {
			redisPort = "6379"
		}
		RedisClient = redis.NewClient(&redis.Options{
			Addr: fmt.Sprintf("%s:%s", redisHost, redisPort),
		})
	}

	JWTSecret = os.Getenv("JWT_SECRET")
	if JWTSecret == "" {
		JWTSecret = "SuperSecretJwtKey2026ProcessInstruments!"
	}

	// Seed default root admin and role users
	seedDefaultUsers()
}

func seedDefaultUsers() {
	username := os.Getenv("DEFAULT_ADMIN_USERNAME")
	password := os.Getenv("DEFAULT_ADMIN_PASSWORD")

	if username == "" {
		username = "fati_sadiki"
	}
	if password == "" {
		password = "fati2004@"
	}

	// One account, one role. The technician carries every permission on the
	// platform, so there is nothing left for the old per-role logins to do.
	seedSingleUser(
		username,
		password,
		"fati_sadiki@process-instruments.ma",
		"Fatima-Ezzahrae Sadiki",
		models.RoleTechnician,
	)

	// Any account left over from the previous four-role deployment would carry
	// a role value the enum no longer accepts, which breaks every query that
	// scans the users table. Migrate them onto the single role.
	if err := DB.Exec(
		"UPDATE users SET role = ?::user_role WHERE role::text <> ?",
		string(models.RoleTechnician), string(models.RoleTechnician),
	).Error; err != nil {
		log.Printf("Role migration skipped: %v", err)
	}
}

func seedSingleUser(username, password, email, fullName string, role models.UserRole) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("Failed to hash password for %s: %v", username, err)
		return
	}

	var existingUser models.User
	if err := DB.Where("username = ?", username).First(&existingUser).Error; err == nil {
		// Update password hash to guarantee fati2004@ works cleanly
		existingUser.PasswordHash = string(hash)
		existingUser.Role = role
		DB.Save(&existingUser)
		log.Printf("User '%s' updated with valid bcrypt password hash.", username)
		return
	}

	user := models.User{
		Username:     username,
		Email:        email,
		PasswordHash: string(hash),
		FullName:     fullName,
		Role:         role,
		IsActive:     true,
	}

	if err := DB.Create(&user).Error; err != nil {
		log.Printf("Failed to seed user %s: %v", username, err)
	} else {
		log.Printf("User '%s' (%s) seeded successfully.", username, role)
	}
}
