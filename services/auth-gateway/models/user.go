package models

import (
	"time"
)

type UserRole string

const (
	RoleAdministrator UserRole = "ADMINISTRATOR"
	RoleTechnician    UserRole = "TECHNICIAN"
	RoleValidator     UserRole = "VALIDATOR"
	RoleDirector      UserRole = "DIRECTOR"
)

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
