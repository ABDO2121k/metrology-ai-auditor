package models

import (
	"time"
)

type UserRole string

// The platform has a single role. A technician performs every task: uploading
// certificates, reviewing OCR extractions, running the metrological audit,
// producing reports, and administering accounts. RBAC is therefore reduced to
// "is this request authenticated?", but the type is kept so that the JWT
// claim, the database enum and the API surface stay explicit.
const (
	RoleTechnician UserRole = "TECHNICIAN"
)

// DefaultRole is applied to every account created through the API.
const DefaultRole = RoleTechnician

// IsValid reports whether a role value is one the platform recognises.
func (r UserRole) IsValid() bool {
	return r == RoleTechnician
}

// Normalize coerces any incoming role to the single supported value, so a
// stale client sending "VALIDATOR" cannot create an account the database
// enum would reject.
func Normalize(role UserRole) UserRole {
	if role.IsValid() {
		return role
	}
	return DefaultRole
}

type User struct {
	ID           string    `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	Username     string    `gorm:"uniqueIndex;not null" json:"username"`
	Email        string    `gorm:"uniqueIndex;not null" json:"email"`
	PasswordHash string    `gorm:"column:password_hash;not null" json:"-"`
	FullName     string    `gorm:"column:full_name;not null" json:"full_name"`
	Role         UserRole  `gorm:"type:user_role;default:'TECHNICIAN'" json:"role"`
	IsActive     bool      `gorm:"column:is_active;default:true" json:"is_active"`
	CreatedAt    time.Time `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	UpdatedAt    time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updated_at"`
}

func (User) TableName() string {
	return "users"
}
