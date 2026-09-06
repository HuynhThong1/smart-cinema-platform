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
	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
	"smartcinema/internal/auth"
	"smartcinema/internal/domain"
	"strings"
	"time"
	"unicode"
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

// printLayout places the card contents in millimetres for one paper size. The
// values are explicit per size rather than scaled from A6, because an 80mm
// sticker cannot fit the same proportions as a 148mm card.
type printLayout struct {
	format          string // gofpdf page name; empty means custom
	page            gofpdf.SizeType
	margin          float64
	logoY, logoW    float64
	qrY, qrSize     float64
	textY           float64
	titlePt, bodyPt float64
	lineH           float64
	english, note   bool
}

// The logo asset is a square canvas whose artwork occupies roughly the middle
// 10%-45% band, so qrY must clear logoY+0.45*logoW or the QR clips the mark.
var printLayouts = map[string]printLayout{
	"a6":      {format: "A6", margin: 10, logoY: 12, logoW: 45, qrY: 33, qrSize: 61, textY: 99, titlePt: 13, bodyPt: 10, lineH: 7, english: true, note: true},
	"a5":      {format: "A5", margin: 14, logoY: 16, logoW: 64, qrY: 48, qrSize: 86, textY: 142, titlePt: 18, bodyPt: 14, lineH: 10, english: true, note: true},
	"sticker": {page: gofpdf.SizeType{Wd: 80, Ht: 80}, margin: 5, logoY: 1, logoW: 30, qrY: 16, qrSize: 44, textY: 61, titlePt: 8, bodyPt: 6.5, lineH: 4.3, english: false, note: true},
}

var deaccent = transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)

// slug renders a Vietnamese name as ASCII so the filename survives every OS and
// unzip tool, and so Content-Disposition needs no encoding.
func slug(value string) string {
	value = strings.NewReplacer("đ", "d", "Đ", "D").Replace(value)
	if folded, _, e := transform.String(deaccent, value); e == nil {
		value = folded
	}
	var b strings.Builder
	for _, r := range value {
		switch {
		case r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9':
			b.WriteRune(r)
		case b.Len() > 0 && !strings.HasSuffix(b.String(), "-"):
			b.WriteRune('-')
		}
	}
	return strings.Trim(b.String(), "-")
}

// exportName is empCode_empFullname_type, where type is the paper size for a
// print template and the file format otherwise.
func exportName(st domain.Staff, kind, extension string) string {
	parts := []string{}
	for _, part := range []string{slug(st.StaffCode), slug(st.Name), kind} {
		if part != "" {
			parts = append(parts, part)
		}
	}
	return strings.Join(parts, "_") + "." + extension
}

func qrPDF(png []byte, size string) ([]byte, error) {
	layout, ok := printLayouts[size]
	if !ok {
		layout = printLayouts["a6"]
	}
	var pdf *gofpdf.Fpdf
	if layout.format != "" {
		pdf = gofpdf.New("P", "mm", layout.format, "")
	} else {
		pdf = gofpdf.NewCustom(&gofpdf.InitType{UnitStr: "mm", Size: layout.page})
	}
	font, err := printAssets.ReadFile("assets/SourceSerif4-Regular.ttf")
	if err != nil {
		return nil, err
	}
	logo, err := printAssets.ReadFile("assets/galaxy-logo.png")
	if err != nil {
		return nil, err
	}
	pdf.AddUTF8FontFromBytes("SourceSerif", "", font)
	pdf.SetMargins(layout.margin, layout.margin, layout.margin)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()
	width, _ := pdf.GetPageSize()
	text := width - 2*layout.margin
	pdf.RegisterImageOptionsReader("logo", gofpdf.ImageOptions{ImageType: "PNG"}, bytes.NewReader(logo))
	pdf.ImageOptions("logo", (width-layout.logoW)/2, layout.logoY, layout.logoW, 0, false, gofpdf.ImageOptions{ImageType: "PNG"}, 0, "")
	pdf.RegisterImageOptionsReader("qr", gofpdf.ImageOptions{ImageType: "PNG"}, bytes.NewReader(png))
	pdf.ImageOptions("qr", (width-layout.qrSize)/2, layout.qrY, layout.qrSize, layout.qrSize, false, gofpdf.ImageOptions{ImageType: "PNG"}, 0, "")
	pdf.SetY(layout.textY)
	pdf.SetFont("SourceSerif", "", layout.titlePt)
	pdf.SetTextColor(31, 41, 55)
	pdf.CellFormat(text, layout.lineH, "QUÉT MÃ ĐỂ ĐÁNH GIÁ", "", 1, "C", false, 0, "")
	pdf.CellFormat(text, layout.lineH, "TRẢI NGHIỆM CỦA BẠN", "", 1, "C", false, 0, "")
	pdf.SetFont("SourceSerif", "", layout.bodyPt)
	if layout.english {
		pdf.CellFormat(text, layout.lineH, "Scan to rate your experience", "", 1, "C", false, 0, "")
	}
	if layout.note {
		pdf.SetTextColor(3, 78, 162)
		pdf.CellFormat(text, layout.lineH, "Chỉ mất 15–30 giây", "", 1, "C", false, 0, "")
	}
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
	size := c.DefaultQuery("size", "a6")
	var content []byte
	mime := "image/png"
	kind := format
	switch format {
	case "svg":
		content = qrSVG(code)
		mime = "image/svg+xml"
	case "png":
		content, e = code.PNG(512)
	case "pdf":
		if _, ok := printLayouts[size]; !ok {
			fail(c, 400, "Use a6, a5 or sticker")
			return
		}
		kind = size
		var png []byte
		png, e = code.PNG(512)
		if e == nil {
			content, e = qrPDF(png, size)
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
	c.Header("Content-Disposition", `attachment; filename="`+exportName(st, kind, format)+`"`)
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
		w, e := z.Create(exportName(st, "png", "png"))
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
