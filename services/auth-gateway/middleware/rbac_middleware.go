package middleware

import (
	"github.com/gofiber/fiber/v2"
)

// RequireAuthenticated gates a route on a valid session rather than on a role.
//
// The platform runs on a single role, so authorisation collapses to
// authentication: any signed-in user may perform any action. JWTMiddleware has
// already validated the token by this point; this handler exists to catch a
// route that was mounted without it, which would otherwise silently expose an
// endpoint.
func RequireAuthenticated() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if c.Locals("user_id") == nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Authentication required",
			})
		}
		return c.Next()
	}
}
