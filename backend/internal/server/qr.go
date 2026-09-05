package server

import (
	"archive/zip"
	"bytes"
	"context"
	"embed"
	"errors"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/phpdave11/gofpdf"
	qrcode "github.com/skip2/go-qrcode"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"smartcinema/internal/auth"
	"smartcinema/internal/domain"
	"strings"
	"time"
)

func (s *Server) qrResponse(q domain.QR) gin.H {
	return gin.H{"id": q.ID, "staffId": q.StaffID, "status": q.Status, "publicToken": q.PublicToken, "updatedAt": q.UpdatedAt, "url": s.PublicURL + "/f/" + q.PublicToken}
}
func (s *Server) getQR(c *gin.Context) {
	st, ok := s.staff(c, c.Param("id"))
	if !ok {
		return
	}
	var q domain.QR
	e := s.Store.Get(c.Request.Context(), "staff_qr_codes", bson.M{"staffId": st.ID}, &q)
	if errors.Is(e, mongo.ErrNoDocuments) {
		c.JSON(200, gin.H{"status": "NOT_GENERATED", "staffId": st.ID})
		return
	}
	if e != nil {
		dbError(c, e)
		return
	}
	c.JSON(200, s.qrResponse(q))
}
func (s *Server) generateQR(c *gin.Context)   { s.changeQR(c, false) }
func (s *Server) regenerateQR(c *gin.Context) { s.changeQR(c, true) }
func (s *Server) changeQR(c *gin.Context, regenerate bool) {
	st, ok := s.staff(c, c.Param("id"))
	if !ok {
		return
	}
	if st.Status != "ACTIVE" {
		fail(c, 422, "Staff must be active")
		return
	}
	var q domain.QR
	action := "GENERATE_QR"
	if regenerate {
		action = "REGENERATE_QR"
	}
	if !s.mutate(c, action, st.ID, st.CinemaID, func(ctx context.Context) error {
		e := s.Store.Get(ctx, "staff_qr_codes", bson.M{"staffId": st.ID}, &q)
		exists := e == nil
		if e != nil && !errors.Is(e, mongo.ErrNoDocuments) {
			return e
		}
		if exists && !regenerate {
			return nil
		}
		now := time.Now().UTC()
		if !exists {
			q = domain.QR{ID: domain.ID(), StaffID: st.ID, CreatedAt: now, CreatedBy: auth.Current(c).Name}
		}
		q.CinemaID = st.CinemaID
		q.PublicToken = domain.ID()
		q.Status = "ACTIVE"
		q.UpdatedAt = now
		if exists {
			return s.Store.Replace(ctx, "staff_qr_codes", q.ID, q)
		}
		return s.Store.Insert(ctx, "staff_qr_codes", q)
	}) {
		return
	}
	c.JSON(200, s.qrResponse(q))
}
func (s *Server) disableQR(c *gin.Context) {
	st, ok := s.staff(c, c.Param("id"))
	if !ok {
		return
	}
	var q domain.QR
	if !s.mutate(c, "DISABLE_QR", st.ID, st.CinemaID, func(ctx context.Context) error {
		if e := s.Store.Get(ctx, "staff_qr_codes", bson.M{"staffId": st.ID}, &q); e != nil {
			return e
		}
		q.Status = "DISABLED"
		q.UpdatedAt = time.Now().UTC()
		return s.Store.Replace(ctx, "staff_qr_codes", q.ID, q)
	}) {
		return
	}
	c.JSON(200, s.qrResponse(q))
}
func (s *Server) batchQR(c *gin.Context) {
	f, ok := scope(c, "cinemaId")
	if !ok {
		return
	}
	f["status"] = "ACTIVE"
	staff := []domain.Staff{}
	if e := s.Store.List(c.Request.Context(), "staff", f, bson.D{{Key: "staffCode", Value: 1}}, 0, 1001, &staff); e != nil {
		dbError(c, e)
		return
	}
	if len(staff) > 1000 {
		fail(c, 422, "Select a cinema with at most 1000 staff per batch")
		return
	}
	created := 0
	if !s.mutate(c, "GENERATE_QR_BATCH", "staff", c.Query("cinemaId"), func(ctx context.Context) error {
		created = 0
		for _, st := range staff {
			var q domain.QR
			e := s.Store.Get(ctx, "staff_qr_codes", bson.M{"staffId": st.ID}, &q)
			if e == nil {
				continue
			}
			if !errors.Is(e, mongo.ErrNoDocuments) {
				return e
			}
			now := time.Now().UTC()
			q = domain.QR{ID: domain.ID(), StaffID: st.ID, CinemaID: st.CinemaID, PublicToken: domain.ID(), Status: "ACTIVE", CreatedAt: now, UpdatedAt: now, CreatedBy: auth.Current(c).Name}
			if e = s.Store.Insert(ctx, "staff_qr_codes", q); e != nil {
				return e
			}
			if e = s.Store.Insert(ctx, "audit_logs", domain.Audit{ID: domain.ID(), Actor: auth.Current(c).Name, Action: "GENERATE_QR", Target: st.ID, CinemaID: st.CinemaID, CreatedAt: now}); e != nil {
				return e
			}
			created++
		}
		return nil
	}) {
		return
	}
	c.JSON(200, gin.H{"created": created, "existing": len(staff) - created})
}
func qrSVG(q *qrcode.QRCode) []byte {
	bits := q.Bitmap()
	var b strings.Builder
	fmt.Fprintf(&b, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" shape-rendering="crispEdges"><rect width="100%%" height="100%%" fill="white"/><path fill="black" d="`, len(bits), len(bits))
	for y, row := range bits {
		for x, on := range row {
			if on {
				fmt.Fprintf(&b, "M%d %dh1v1h-1z", x, y)
			}
		}
	}
	b.WriteString(`"/></svg>`)
	return []byte(b.String())
}

//go:embed assets/*
var printAssets embed.FS

func qrPDF(png []byte) ([]byte, error) {
	pdf := gofpdf.New("P", "mm", "A6", "")
	font, err := printAssets.ReadFile("assets/SourceSerif4-Regular.ttf")
	if err != nil {
		return nil, err
	}
	logo, err := printAssets.ReadFile("assets/galaxy-logo.png")
	if err != nil {
		return nil, err
	}
	pdf.AddUTF8FontFromBytes("SourceSerif", "", font)
	pdf.AddPage()
	pdf.RegisterImageOptionsReader("logo", gofpdf.ImageOptions{ImageType: "PNG"}, bytes.NewReader(logo))
	pdf.ImageOptions("logo", 30, 12, 45, 0, false, gofpdf.ImageOptions{ImageType: "PNG"}, 0, "")
	pdf.RegisterImageOptionsReader("qr", gofpdf.ImageOptions{ImageType: "PNG"}, bytes.NewReader(png))
	pdf.ImageOptions("qr", 22, 33, 61, 61, false, gofpdf.ImageOptions{ImageType: "PNG"}, 0, "")
	pdf.SetY(99)
	pdf.SetFont("SourceSerif", "", 13)
	pdf.SetTextColor(31, 41, 55)
	pdf.CellFormat(85, 7, "QUÉT MÃ ĐỂ ĐÁNH GIÁ", "", 1, "C", false, 0, "")
	pdf.CellFormat(85, 7, "TRẢI NGHIỆM CỦA BẠN", "", 1, "C", false, 0, "")
	pdf.SetFont("SourceSerif", "", 10)
	pdf.CellFormat(85, 7, "Scan to rate your experience", "", 1, "C", false, 0, "")
	pdf.SetTextColor(3, 78, 162)
	pdf.CellFormat(85, 7, "Chỉ mất 15–30 giây", "", 1, "C", false, 0, "")
	var b bytes.Buffer
	err = pdf.Output(&b)
	return b.Bytes(), err
}
func (s *Server) downloadQR(c *gin.Context) {
	st, ok := s.staff(c, c.Param("id"))
	if !ok {
		return
	}
	var q domain.QR
	if e := s.Store.Get(c.Request.Context(), "staff_qr_codes", bson.M{"staffId": st.ID, "status": "ACTIVE"}, &q); e != nil {
		dbError(c, e)
		return
	}
	code, e := qrcode.New(s.PublicURL+"/f/"+q.PublicToken, qrcode.Medium)
	if e != nil {
		fail(c, 500, "Unable to encode QR")
		return
	}
	format := c.DefaultQuery("format", "png")
	var content []byte
	mime := "image/png"
	switch format {
	case "svg":
		content = qrSVG(code)
		mime = "image/svg+xml"
	case "png":
		content, e = code.PNG(512)
	case "pdf":
		var png []byte
		png, e = code.PNG(512)
		if e == nil {
			content, e = qrPDF(png)
		}
		mime = "application/pdf"
	default:
		fail(c, 400, "Use png, svg or pdf")
		return
	}
	if e != nil {
		fail(c, 500, "Unable to generate file")
		return
	}
	c.Header("Content-Disposition", `attachment; filename="qr-`+st.ID+`.`+format+`"`)
	c.Data(200, mime, content)
}
func (s *Server) qrPackage(c *gin.Context) {
	f, ok := scope(c, "cinemaId")
	if !ok {
		return
	}
	f["status"] = "ACTIVE"
	staff := []domain.Staff{}
	if e := s.Store.List(c.Request.Context(), "staff", f, bson.D{{Key: "staffCode", Value: 1}}, 0, 1001, &staff); e != nil {
		dbError(c, e)
		return
	}
	if len(staff) > 1000 {
		fail(c, 422, "Select a smaller cinema scope")
		return
	}
	var b bytes.Buffer
	z := zip.NewWriter(&b)
	for _, st := range staff {
		var q domain.QR
		e := s.Store.Get(c.Request.Context(), "staff_qr_codes", bson.M{"staffId": st.ID, "status": "ACTIVE"}, &q)
		if errors.Is(e, mongo.ErrNoDocuments) {
			continue
		}
		if e != nil {
			dbError(c, e)
			return
		}
		code, e := qrcode.New(s.PublicURL+"/f/"+q.PublicToken, qrcode.Medium)
		if e != nil {
			fail(c, 500, "QR export failed")
			return
		}
		png, e := code.PNG(512)
		if e != nil {
			fail(c, 500, "QR export failed")
			return
		}
		w, e := z.Create(st.ID + ".png")
		if e != nil {
			fail(c, 500, "ZIP export failed")
			return
		}
		if _, e = w.Write(png); e != nil {
			fail(c, 500, "ZIP export failed")
			return
		}
	}
	if e := z.Close(); e != nil {
		fail(c, 500, "ZIP export failed")
		return
	}
	c.Header("Content-Disposition", `attachment; filename="staff-qr.zip"`)
	c.Data(200, "application/zip", b.Bytes())
}
