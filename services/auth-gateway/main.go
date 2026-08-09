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
		AppName:      "Process Instruments Auth Gateway v1.0",
		ServerHeader: "Fiber-Gateway",
		BodyLimit:    50 * 1024 * 1024, // 50MB limit for PDF uploads
	})

	// Global Middlewares
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "*",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowCredentials: false,
	}))

	// Health Check
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "healthy",
			"service": "auth-gateway",
		})
	})

	// Public Auth Endpoints
	api := app.Group("/api/v1")
	auth := api.Group("/auth")
	auth.Post("/login", controllers.Login)

	// Protected Endpoints
	protected := api.Group("/", middleware.JWTMiddleware())
	protected.Get("/auth/profile", controllers.GetProfile)
	protected.Put("/auth/change-password", controllers.ChangePassword)

	// Admin Only User & Password Management Endpoints
	admin := protected.Group("/admin", middleware.RequireRole("ADMINISTRATOR"))
	admin.Get("/users", controllers.ListUsers)
	admin.Post("/users/register", controllers.Register)
	admin.Put("/users/:id/reset-password", controllers.AdminResetPassword)
	admin.Get("/system/health", controllers.GetSystemHealth)

	// Director & Admin Analytics Endpoint
	analytics := protected.Group("/analytics", middleware.RequireRole("DIRECTOR", "ADMINISTRATOR", "VALIDATOR"))
	analytics.Get("/dashboard", controllers.GetAnalytics)

	// Dynamic Reverse Proxy Routes to Downstream Microservices
	// Handle preflight OPTIONS for proxied routes without requiring auth
	app.Options("/certificates*", func(c *fiber.Ctx) error {
		c.Set("Access-Control-Allow-Origin", "*")
		c.Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		c.Set("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization")
		return c.SendStatus(fiber.StatusNoContent)
	})
	app.Options("/ocr*", func(c *fiber.Ctx) error {
		c.Set("Access-Control-Allow-Origin", "*")
		c.Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		c.Set("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization")
		return c.SendStatus(fiber.StatusNoContent)
	})

	protected.All("/certificates*", middleware.RequireRole("TECHNICIAN", "VALIDATOR", "DIRECTOR", "ADMINISTRATOR"), func(c *fiber.Ctx) error {
		docSvcURL := os.Getenv("DOCUMENT_SERVICE_URL")
		if docSvcURL == "" {
			docSvcURL = "http://localhost:8001"
		}
		target := docSvcURL + c.Path()
		err := proxy.Forward(target)(c)
		// Ensure CORS header present on proxied response
		c.Set("Access-Control-Allow-Origin", "*")
		return err
	})

	protected.All("/ocr*", middleware.RequireRole("TECHNICIAN", "VALIDATOR", "DIRECTOR", "ADMINISTRATOR"), func(c *fiber.Ctx) error {
		ocrSvcURL := os.Getenv("OCR_SERVICE_URL")
		if ocrSvcURL == "" {
			ocrSvcURL = "http://localhost:8002"
		}
		target := ocrSvcURL + c.Path()
		err := proxy.Forward(target)(c)
		// Ensure CORS header present on proxied response
		c.Set("Access-Control-Allow-Origin", "*")
		return err
	})

	protected.All("/metrology*", middleware.RequireRole("VALIDATOR", "DIRECTOR", "ADMINISTRATOR"), func(c *fiber.Ctx) error {
		metroSvcURL := os.Getenv("METROLOGY_SERVICE_URL")
		if metroSvcURL == "" {
			metroSvcURL = "http://localhost:8003"
		}
		target := metroSvcURL + c.Path()
		return proxy.Forward(target)(c)
	})

	protected.All("/anomalies*", middleware.RequireRole("VALIDATOR", "DIRECTOR", "ADMINISTRATOR"), func(c *fiber.Ctx) error {
		aiSvcURL := os.Getenv("AI_SERVICE_URL")
		if aiSvcURL == "" {
			aiSvcURL = "http://localhost:8004"
		}
		target := aiSvcURL + c.Path()
		return proxy.Forward(target)(c)
	})

	port := os.Getenv("PORT_GATEWAY")
	if port == "" {
		port = "8000"
	}

	log.Printf("Auth Gateway running on port %s", port)
	log.Fatal(app.Listen(":" + port))
}
