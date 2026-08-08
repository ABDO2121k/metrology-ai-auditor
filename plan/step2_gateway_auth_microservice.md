# Step 2: API Gateway & Authentication Microservice (`auth-gateway`)

## 1. Objective & Scope

Build an ultra-fast, lightweight API Gateway and Authentication Microservice using **Go (Fiber v2)**.

The `auth-gateway` acts as the single entry point for all client requests from the Next.js frontend, providing:
- JWT Token Generation & Verification (HS256/RS256).
- Role-Based Access Control (RBAC) for `ADMINISTRATOR`, `TECHNICIAN`, `VALIDATOR`.
- High-performance reverse proxy routing to internal microservices via HTTP/gRPC.
- Distributed IP & Token rate limiting backed by Redis.
- CORS policy enforcement and security headers (Helmet equivalents in Go).

---

## 2. Recommended Technology Choice

- **Language**: Go 1.22+
- **Framework**: `gofiber/fiber/v2` (Fasthttp engine, up to 10x faster than traditional Node/Express or Django gateways).
- **Security & Tokens**: `golang-jwt/jwt/v5`, `golang.org/x/crypto/bcrypt`.
- **Cache Client**: `redis/go-redis/v9`.

---

## 3. Microservice Project Layout (`app/services/auth-gateway/`)

```
auth-gateway/
├── main.go
├── go.mod
├── go.sum
├── Dockerfile
├── config/
│   └── config.go
├── controllers/
│   └── auth_controller.go
├── middleware/
│   ├── auth_middleware.go
│   ├── rbac_middleware.go
│   ├── rate_limiter.go
│   └── proxy_middleware.go
├── models/
│   └── user.go
└── routes/
    └── routes.go
```

---

## 4. Implementation Details

### 4.1 Go Entry Point & Reverse Proxy (`main.go`)

```go
package main

import (
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/proxy"

	"auth-gateway/config"
	"auth-gateway/controllers"
	"auth-gateway/middleware"
)

func main() {
	config.InitConfig()

	app := fiber.New(fiber.Config{
		AppName:      "Metrology Auth Gateway v1.0",
		ServerHeader: "Fiber-Gateway",
		BodyLimit:    50 * 1024 * 1024, // 50MB limit for large PDF certificates
	})

	// Global Middlewares
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "http://localhost:3000, https://metrology.pi.ma",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowCredentials: true,
	}))

	// Public Routes
	api := app.Group("/api/v1")
	auth := api.Group("/auth")
	auth.Post("/login", controllers.Login)
	auth.Post("/register", middleware.RequireRole("ADMINISTRATOR"), controllers.Register)

	// Protected Routes Group
	protected := api.Group("/", middleware.JWTMiddleware())

	// Dynamic Microservices Proxy Routing
	protected.All("/certificates*", middleware.RequireRole("TECHNICIAN", "VALIDATOR", "ADMINISTRATOR"), func(c *fiber.Ctx) error {
		docSvcURL := os.Getenv("DOCUMENT_SERVICE_URL") + c.Path()
		return proxy.Forward(docSvcURL)(c)
	})

	protected.All("/ocr*", middleware.RequireRole("TECHNICIAN", "VALIDATOR", "ADMINISTRATOR"), func(c *fiber.Ctx) error {
		ocrSvcURL := os.Getenv("OCR_SERVICE_URL") + c.Path()
		return proxy.Forward(ocrSvcURL)(c)
	})

	protected.All("/metrology*", middleware.RequireRole("VALIDATOR", "ADMINISTRATOR"), func(c *fiber.Ctx) error {
		metroSvcURL := os.Getenv("METROLOGY_SERVICE_URL") + c.Path()
		return proxy.Forward(metroSvcURL)(c)
	})

	protected.All("/anomalies*", middleware.RequireRole("VALIDATOR", "ADMINISTRATOR"), func(c *fiber.Ctx) error {
		aiSvcURL := os.Getenv("AI_SERVICE_URL") + c.Path()
		return proxy.Forward(aiSvcURL)(c)
	})

	log.Fatal(app.Listen(":8000"))
}
```

---

### 4.2 Auth Controller (`controllers/auth_controller.go`)

```go
package controllers

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"auth-gateway/config"
	"auth-gateway/models"
)

type LoginRequest struct {
	Username string `json:"username" validate:"required"`
	Password string `json:"password" validate:"required"`
}

type AuthResponse struct {
	Token     string      `json:"token"`
	ExpiresAt int64       `json:"expires_at"`
	User      models.User `json:"user"`
}

func Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request payload"})
	}

	// Fetch user from DB
	var user models.User
	if err := config.DB.Where("username = ?", req.Username).First(&user).Error; err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	// Verify Password Hash
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	// Generate JWT Token
	expirationTime := time.Now().Add(24 * time.Hour).Unix()
	claims := jwt.MapClaims{
		"user_id":  user.ID,
		"username": user.Username,
		"role":     user.Role,
		"exp":      expirationTime,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(config.JWTSecret))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Token generation failed"})
	}

	user.PasswordHash = "" // Mask hash before response

	return c.JSON(AuthResponse{
		Token:     tokenString,
		ExpiresAt: expirationTime,
		User:      user,
	})
}
```

---

### 4.3 Containerization (`Dockerfile`)

```dockerfile
# Multi-stage build for minimal image size (~15MB)
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o gateway .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/gateway .
EXPOSE 8000
CMD ["./gateway"]
```

---

## 5. Security & Verification Checklist

- [ ] Test JWT Login endpoint `POST /api/v1/auth/login` with valid credentials. Receive 200 OK and JWT string.
- [ ] Attempt accessing `POST /api/v1/certificates/upload` without Bearer token. Expect `401 Unauthorized`.
- [ ] Attempt accessing `/metrology/validate` with a `TECHNICIAN` role token. Expect `403 Forbidden` (RBAC enforced).
- [ ] Verify execution latency is under **3ms** per proxied request.
