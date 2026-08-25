package main

import (
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"

	"document-ingestion/handlers"
	"document-ingestion/services"
)

func main() {
	services.InitServices()

	app := fiber.New(fiber.Config{
		AppName:   "Process Instruments Document Ingestion Service",
		BodyLimit: 50 * 1024 * 1024, // 50MB PDF upload limit
	})

	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
	}))

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "healthy",
			"service": "document-ingestion",
		})
	})

	api := app.Group("/api/v1/certificates")
	api.Post("/upload", handlers.UploadCertificate)
	api.Get("/", handlers.ListCertificates)
	api.Get("/stats", handlers.GetStats)
	api.Get("/:id", handlers.GetCertificateByID)
	// Stored extraction. Reading a certificate must never trigger a new OCR run.
	api.Get("/:id/ocr", handlers.GetCertificateOCR)
	api.Post("/:id/reprocess", handlers.ReprocessCertificate)
	api.Delete("/:id", handlers.DeleteCertificate)

	port := os.Getenv("PORT_DOCUMENT")
	if port == "" {
		port = "8001"
	}

	log.Printf("Document Ingestion Service running on port %s", port)
	log.Fatal(app.Listen(":" + port))
}
