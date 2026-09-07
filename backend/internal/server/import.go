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
	Row             int    `json:"row"`
	StaffCode       string `json:"staffCode"`
	Name            string `json:"name"`
	CinemaCode      string `json:"cinemaCode"`
	CinemaID        string `json:"cinemaId"`
	ManagerUsername string `json:"managerUsername"`
	ManagerID       string `json:"managerId"`
	Error           string `json:"error"`
	ErrorCode       string `json:"errorCode,omitempty"`
}

func (s *Server) importTemplate(c *gin.Context) {
	book := excelize.NewFile()
	defer book.Close()
	sheet := book.GetSheetName(0)
	if err := book.SetSheetRow(sheet, "A1", &[]string{"Staff Code", "Full Name", "Cinema Code", "Manager Username"}); err != nil {
		fail(c, 500, "Unable to create template")
		return
	}
	_ = book.SetColWidth(sheet, "A", "D", 26)
	_ = book.SetColWidth(sheet, "B", "B", 36)
	_ = book.SetPanes(sheet, &excelize.Panes{Freeze: true, YSplit: 1, TopLeftCell: "A2", ActivePane: "bottomLeft"})
	style, err := book.NewStyle(&excelize.Style{NumFmt: 49})
	if err != nil {
		fail(c, 500, "Unable to create template")
		return
	}
	_ = book.SetColStyle(sheet, "A:D", style)
	_, _ = book.NewSheet("Hướng dẫn")
	notes := []string{
		"Nhập nhân viên tại Sheet1 từ dòng 2; giữ nguyên tên các cột.",
		"Staff Code: mã nhân viên duy nhất, 2–50 ký tự.",
		"Full Name: họ tên nhân viên, 2–100 ký tự.",
		"Cinema Code: mã rạp đang hoạt động và thuộc phạm vi được quản lý.",
		"Manager Username: tên đăng nhập chính xác của quản lý trực tiếp đang hoạt động, cùng rạp.",
		"Có thể để trống Manager Username; nhân viên chưa được gán sẽ chưa gửi thông báo cho quản lý.",
		"Tối đa 1.000 nhân viên. Kiểm tra preview rồi xác nhận để lưu các dòng hợp lệ.",
	}
	for i, note := range notes {
		_ = book.SetCellStr("Hướng dẫn", fmt.Sprintf("A%d", i+1), note)
	}
	_ = book.SetColWidth("Hướng dẫn", "A", "A", 120)
	buf, err := book.WriteToBuffer()
	if err != nil {
		fail(c, 500, "Unable to create template")
		return
	}
	c.Header("Content-Disposition", `attachment; filename="staff-template.xlsx"`)
	c.Data(200, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buf.Bytes())
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
	if len(rows[0]) > 4 || (len(rows[0]) == 4 && strings.TrimSpace(rows[0][3]) != "Manager Username") {
		fail(c, 422, "Fourth header must be Manager Username")
		return
	}
	managers := map[string][]auth.User{}
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
		if len(row) > 3 {
			v.ManagerUsername = strings.TrimSpace(row[3])
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

			}
		}
		if v.Error == "" && v.ManagerUsername != "" {
			if s.Users == nil {
				fail(c, 503, "Dịch vụ quản lý tài khoản chưa được cấu hình")
				return
			}
			candidates, ok := managers[v.CinemaID]
			if !ok {
				var err error
				candidates, err = s.Users.Managers(c.Request.Context(), v.CinemaID)
				if err != nil {
					fail(c, 502, "Không xác minh được quản lý trực tiếp")
					return
				}
				managers[v.CinemaID] = candidates
			}
			for _, manager := range candidates {
				if manager.Username == v.ManagerUsername {
					v.ManagerID = manager.ID
					break
				}
			}
			if v.ManagerID == "" {
				v.Error = "Quản lý không tồn tại, bị khoá hoặc không thuộc rạp này"
			}
		}
		if v.Error == "" {
			valid++
		}
		if v.Error != "" {
			v.ErrorCode = importErrorCode(v.Error)
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
				st := domain.Staff{ID: domain.ID(), StaffCode: row.StaffCode, Name: row.Name, CinemaID: row.CinemaID, ManagerID: row.ManagerID, Status: "ACTIVE", CreatedAt: now, UpdatedAt: now}
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
