package server

import (
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
	"go.mongodb.org/mongo-driver/v2/bson"
	"io"
	"path/filepath"
	"smartcinema/internal/auth"
	"smartcinema/internal/domain"
	"strings"
	"time"
)

type importRow struct {
	Row        int    `json:"row"`
	StaffCode  string `json:"staffCode"`
	Name       string `json:"name"`
	CinemaCode string `json:"cinemaCode"`
	CinemaID   string `json:"cinemaId"`
	Error      string `json:"error"`
}

func (s *Server) importTemplate(c *gin.Context) {
	c.Header("Content-Disposition", `attachment; filename="staff-template.csv"`)
	c.Data(200, "text/csv; charset=utf-8", []byte("\xef\xbb\xbfStaff Code,Full Name,Cinema Code\nEXAMPLE001,Example Staff,GND\n"))
}
func (s *Server) importStaff(c *gin.Context) {
	fh, e := c.FormFile("file")
	if e != nil {
		fail(c, 400, "CSV or XLSX file required (maximum 5 MB)")
		return
	}
	f, e := fh.Open()
	if e != nil {
		fail(c, 400, "Unable to read file")
		return
	}
	defer f.Close()
	data, e := io.ReadAll(io.LimitReader(f, 5<<20+1))
	if e != nil || len(data) > 5<<20 {
		fail(c, 413, "Maximum file size is 5 MB")
		return
	}
	var rows [][]string
	switch strings.ToLower(filepath.Ext(fh.Filename)) {
	case ".csv":
		reader := csv.NewReader(bytes.NewReader(bytes.TrimPrefix(data, []byte{239, 187, 191})))
		reader.FieldsPerRecord = -1
		rows, e = reader.ReadAll()
	case ".xlsx":
		var book *excelize.File
		book, e = excelize.OpenReader(bytes.NewReader(data), excelize.Options{UnzipSizeLimit: 20 << 20, UnzipXMLSizeLimit: 10 << 20})
		if e == nil {
			defer book.Close()
			sheets := book.GetSheetList()
			if len(sheets) > 0 {
				rows, e = book.GetRows(sheets[0])
			}
		}
	default:
		fail(c, 400, "Only .csv and .xlsx are supported")
		return
	}
	if e != nil || len(rows) < 2 || len(rows) > 1001 {
		fail(c, 422, "File must contain a header and 1–1000 valid rows")
		return
	}
	if len(rows[0]) < 3 || strings.TrimSpace(rows[0][0]) != "Staff Code" || strings.TrimSpace(rows[0][1]) != "Full Name" || strings.TrimSpace(rows[0][2]) != "Cinema Code" {
		fail(c, 422, "Headers must be Staff Code, Full Name, Cinema Code")
		return
	}
	result := []importRow{}
	valid := 0
	seen := map[string]bool{}
	p := auth.Current(c)
	for i, row := range rows[1:] {
		v := importRow{Row: i + 2}
		if len(row) >= 3 {
			v.StaffCode = strings.ToUpper(strings.TrimSpace(row[0]))
			v.Name = strings.TrimSpace(row[1])
			v.CinemaCode = strings.ToUpper(strings.TrimSpace(row[2]))
		}
		switch {
		case len(v.StaffCode) < 2 || len(v.StaffCode) > 50:
			v.Error = "Thiếu staff code hoặc mã quá dài"
		case !domain.ValidName(v.Name):
			v.Error = "Họ tên phải có 2–100 ký tự"
		case seen[v.StaffCode]:
			v.Error = "Staff code trùng trong file"
		}
		seen[v.StaffCode] = true
		if v.Error == "" {
			n, err := s.Store.Count(c.Request.Context(), "staff", bson.M{"staffCode": v.StaffCode})
			if err != nil {
				dbError(c, err)
				return
			}
			if n > 0 {
				v.Error = "Staff code đã tồn tại"
			}
		}
		if v.Error == "" {
			var ci domain.Cinema
			err := s.Store.Get(c.Request.Context(), "cinemas", bson.M{"code": v.CinemaCode, "status": "ACTIVE"}, &ci)
			if err != nil {
				v.Error = "Cinema code không tồn tại hoặc không hoạt động"
			} else if !p.CanCinema(ci.ID) {
				v.Error = "Không có quyền truy cập rạp"
			} else {
				v.CinemaID = ci.ID
				valid++
			}
		}
		result = append(result, v)
	}
	confirmed := c.PostForm("confirm") == "true"
	imported := 0
	if confirmed && valid > 0 {
		cinema := p.CinemaID
		if !s.mutate(c, "IMPORT_STAFF", fmt.Sprintf("%d rows", valid), cinema, func(ctx context.Context) error {
			imported = 0
			for _, row := range result {
				if row.Error != "" {
					continue
				}
				now := time.Now().UTC()
				st := domain.Staff{ID: domain.ID(), StaffCode: row.StaffCode, Name: row.Name, CinemaID: row.CinemaID, Status: "ACTIVE", CreatedAt: now, UpdatedAt: now}
				if err := s.Store.Insert(ctx, "staff", st); err != nil {
					return err
				}
				if err := s.Store.Insert(ctx, "audit_logs", domain.Audit{ID: domain.ID(), Actor: auth.Current(c).Name, Action: "CREATE_STAFF", Target: st.ID, CinemaID: st.CinemaID, CreatedAt: now}); err != nil {
					return err
				}
				imported++
			}
			return nil
		}) {
			return
		}
	}
	c.JSON(200, gin.H{"rows": result, "total": len(result), "valid": valid, "invalid": len(result) - valid, "imported": imported, "confirmed": confirmed})
}
