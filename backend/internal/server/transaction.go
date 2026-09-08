package server

import (
	"github.com/gin-gonic/gin"
	"smartcinema/internal/domain"
	"strings"
)

// The wildcard preserves the slash in the printed Trans No, including decoded URLs.
// Until a trusted POS adapter exists, no ticket metadata or verification is invented.
func (s *Server) publicTransaction(c *gin.Context) {
	id, _ := domain.NormalizeTransaction(strings.TrimPrefix(c.Param("transactionId"), "/"), "MANUAL")
	if id == "" {
		fail(c, 422, "Invalid transaction ID")
		return
	}
	c.JSON(200, gin.H{"transactionId": id, "verified": false})
}
