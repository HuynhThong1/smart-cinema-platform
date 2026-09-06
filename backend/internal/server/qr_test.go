package server

import (
	"strings"
	"testing"

	qrcode "github.com/skip2/go-qrcode"
	"smartcinema/internal/domain"
)

func TestExportNameIsCodeNameAndType(t *testing.T) {
	st := domain.Staff{StaffCode: "GBT002", Name: "Nhân viên thử nghiệm 2"}
	for _, tc := range []struct{ kind, extension, want string }{
		{"png", "png", "GBT002_Nhan-vien-thu-nghiem-2_png.png"},
		{"svg", "svg", "GBT002_Nhan-vien-thu-nghiem-2_svg.svg"},
		{"a6", "pdf", "GBT002_Nhan-vien-thu-nghiem-2_a6.pdf"},
		{"a5", "pdf", "GBT002_Nhan-vien-thu-nghiem-2_a5.pdf"},
		{"sticker", "pdf", "GBT002_Nhan-vien-thu-nghiem-2_sticker.pdf"},
	} {
		if got := exportName(st, tc.kind, tc.extension); got != tc.want {
			t.Fatalf("got %q want %q", got, tc.want)
		}
	}
}

func TestExportNameSkipsPartsThatSlugToNothing(t *testing.T) {
	st := domain.Staff{StaffCode: "GBT002", Name: "///"}
	if got := exportName(st, "png", "png"); got != "GBT002_png.png" {
		t.Fatalf("got %q", got)
	}
}

func TestSlugFoldsVietnameseToFilenameSafeASCII(t *testing.T) {
	for value, want := range map[string]string{
		"Nhân viên thử nghiệm 2": "Nhan-vien-thu-nghiem-2",
		"Đặng Thị Hồng Đào":      "Dang-Thi-Hong-Dao",
		"Lê  Văn//An":            "Le-Van-An",
		"  ":                     "",
	} {
		if got := slug(value); got != want {
			t.Fatalf("slug(%q) = %q, want %q", value, got, want)
		}
	}
}

func TestQRPDFRendersOnOnePageForEverySize(t *testing.T) {
	code, e := qrcode.New("https://example.test/f/token", qrcode.Medium)
	if e != nil {
		t.Fatal(e)
	}
	png, e := code.PNG(512)
	if e != nil {
		t.Fatal(e)
	}
	for _, size := range []string{"a6", "a5", "sticker"} {
		out, e := qrPDF(png, size)
		if e != nil {
			t.Fatalf("%s: %v", size, e)
		}
		if !strings.HasPrefix(string(out), "%PDF-") {
			t.Fatalf("%s is not a PDF", size)
		}
		// A print card must never spill onto a second page.
		if pages := strings.Count(string(out), "/Type /Page\n"); pages != 1 {
			t.Fatalf("%s rendered %d pages", size, pages)
		}
	}
}
