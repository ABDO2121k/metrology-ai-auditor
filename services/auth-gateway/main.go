package main

import (
	"io"
	"log"
	"net/http"
	"os"
	"time"

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
	// Account and system administration. Every authenticated user is a
	// technician with full rights, so these need authentication only.
	admin := protected.Group("/admin", middleware.RequireAuthenticated())
	admin.Get("/users", controllers.ListUsers)
	admin.Post("/users/register", controllers.Register)
	admin.Put("/users/:id/reset-password", controllers.AdminResetPassword)
	admin.Get("/system/health", controllers.GetSystemHealth)

	// Platform analytics
	analytics := protected.Group("/analytics", middleware.RequireAuthenticated())
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

	// The stored PDF is streamed rather than proxied.
	//
	// fasthttp — which backs proxy.Forward — reads a proxied response fully
	// into memory and caps it at 4 MB, so a 4.4 MB certificate scan reached
	// the browser as "unexpected EOF". Copying the body through keeps memory
	// flat regardless of file size, which matters on a 2 vCPU host accepting
	// uploads up to 50 MB.
	protected.Get("/certificates/:id/document", middleware.RequireAuthenticated(), func(c *fiber.Ctx) error {
		docSvcURL := os.Getenv("DOCUMENT_SERVICE_URL")
		if docSvcURL == "" {
			docSvcURL = "http://localhost:8001"
		}

		// NOT c.Context(): fasthttp cancels and recycles the request context as
		// soon as the handler returns, which is *before* the body is written.
		// The client timeout below is what bounds this request instead.
		req, err := http.NewRequest(http.MethodGet, docSvcURL+c.Path(), nil)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
		// Carry the caller's identity to the downstream service.
		for _, h := range []string{"X-User-ID", "X-User-Name", "X-User-Role"} {
			if v := c.Get(h); v != "" {
				req.Header.Set(h, v)
			}
		}

		resp, err := (&http.Client{Timeout: 5 * time.Minute}).Do(req)
		if err != nil {
			return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
		}

		if resp.StatusCode >= 400 {
			body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
			resp.Body.Close()
			return c.Status(resp.StatusCode).Send(body)
		}

		for _, h := range []string{"Content-Type", "Content-Disposition", "Cache-Control"} {
			if v := resp.Header.Get(h); v != "" {
				c.Set(h, v)
			}
		}
		c.Set("Access-Control-Allow-Origin", "*")

		// Deliberately not closed here. SendStream hands the reader to
		// fasthttp, which writes it after this handler returns and closes it
		// then — a defer here would shut the body before anything was sent.
		if resp.ContentLength > 0 {
			return c.Status(resp.StatusCode).SendStream(resp.Body, int(resp.ContentLength))
		}
		return c.Status(resp.StatusCode).SendStream(resp.Body)
	})

	protected.All("/certificates*", middleware.RequireAuthenticated(), func(c *fiber.Ctx) error {
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

	protected.All("/ocr*", middleware.RequireAuthenticated(), func(c *fiber.Ctx) error {
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

	protected.All("/metrology*", middleware.RequireAuthenticated(), func(c *fiber.Ctx) error {
		metroSvcURL := os.Getenv("METROLOGY_SERVICE_URL")
		if metroSvcURL == "" {
			metroSvcURL = "http://localhost:8003"
		}
		target := metroSvcURL + c.Path()
		return proxy.Forward(target)(c)
	})

	protected.All("/anomalies*", middleware.RequireAuthenticated(), func(c *fiber.Ctx) error {
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
