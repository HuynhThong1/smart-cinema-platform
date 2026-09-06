package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
	"go.mongodb.org/mongo-driver/v2/bson"
	"smartcinema/internal/auth"
	"smartcinema/internal/domain"
)

func TestImportTemplateWorkbook(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	(&Server{}).importTemplate(c)
	if w.Code != 200 || w.Header().Get("Content-Disposition") != `attachment; filename="staff-template.xlsx"` {
		t.Fatal(w.Code, w.Header())
	}
	book, err := excelize.OpenReader(bytes.NewReader(w.Body.Bytes()))
	if err != nil {
		t.Fatal(err)
	}
	defer book.Close()
	rows, err := book.GetRows(book.GetSheetName(0))
	if err != nil || len(rows) != 1 || len(rows[0]) != 4 || rows[0][3] != "Manager Username" {
		t.Fatal(rows, err)
	}
	if len(book.GetSheetList()) != 2 {
		t.Fatal("missing instructions")
	}
	styleID, err := book.GetCellStyle(book.GetSheetName(0), "A2")
	if err != nil {
		t.Fatal(err)
	}
	style, err := book.GetStyle(styleID)
	if err != nil || style.NumFmt != 49 {
		t.Fatal("codes must use text format", style, err)
	}
}

func TestImportManagerValidationAndPersistence(t *testing.T) {
	f := setup(t)
	active := true
	unavailable := false
	calls := 0
	kc := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if unavailable {
			w.WriteHeader(503)
			return
		}
		if r.URL.Path != "/roles/CINEMA_MANAGER/users" {
			t.Errorf("unexpected identity path %s", r.URL.Path)
			w.WriteHeader(404)
			return
		}
		_ = json.NewEncoder(w).Encode([]auth.User{
			{ID: "manager-1", Username: "manager.gnd", Enabled: active, Attributes: map[string][]string{"cinema_id": {"cinema-gnd"}}},
			{ID: "manager-2", Username: "manager.gbt", Enabled: true, Attributes: map[string][]string{"cinema_id": {"cinema-gbt"}}},
			{ID: "manager-3", Username: "locked", Enabled: false, Attributes: map[string][]string{"cinema_id": {"cinema-gnd"}}},
		})
	}))
	defer kc.Close()
	f.s.Users = &auth.UserAdmin{Base: kc.URL, Client: kc.Client()}
	x := excelize.NewFile()
	defer x.Close()
	rows := [][]string{
		{"Staff Code", "Full Name", "Cinema Code", "Manager Username"},
		{"IMP001", "Valid Manager", "GND", "manager.gnd"},
		{"IMP002", "Wrong Cinema", "GND", "manager.gbt"},
		{"IMP003", "Locked Manager", "GND", "locked"},
		{"IMP004", "Missing Manager", "GND", "missing"},
		{"IMP005", "No Manager", "GND", ""},
	}
	for i, row := range rows {
		cell, _ := excelize.CoordinatesToCellName(1, i+1)
		if err := x.SetSheetRow("Sheet1", cell, &row); err != nil {
			t.Fatal(err)
		}
	}
	buf, err := x.WriteToBuffer()
	if err != nil {
		t.Fatal(err)
	}
	code, out := f.upload(t, "staff.xlsx", buf.Bytes(), false)
	mustStatus(t, 200, code, out)
	if out["valid"] != float64(2) || calls != 1 {
		t.Fatal(out, calls)
	}
	if n, _ := f.s.Store.Count(f.ctx, "staff", bson.M{"staffCode": "IMP001"}); n != 0 {
		t.Fatal("preview wrote staff")
	}
	active = false
	code, out = f.upload(t, "staff.xlsx", buf.Bytes(), true)
	mustStatus(t, 200, code, out)
	if out["imported"] != float64(1) {
		t.Fatal("confirmation did not revalidate manager", out)
	}
	active = true
	code, out = f.upload(t, "staff.xlsx", buf.Bytes(), true)
	mustStatus(t, 200, code, out)
	if out["imported"] != float64(1) {
		t.Fatal(out)
	}
	var staff domain.Staff
	if err := f.s.Store.Get(f.ctx, "staff", bson.M{"staffCode": "IMP001"}, &staff); err != nil || staff.ManagerID != "manager-1" {
		t.Fatal(staff, err)
	}
	unavailable = true
	data := []byte("Staff Code,Full Name,Cinema Code,Manager Username\nIMP006,Service Failure,GND,manager.gnd\n")
	code, out = f.upload(t, "staff.csv", data, true)
	mustStatus(t, 502, code, out)
	if n, _ := f.s.Store.Count(f.ctx, "staff", bson.M{"staffCode": "IMP006"}); n != 0 {
		t.Fatal("upstream failure wrote staff")
	}
}
