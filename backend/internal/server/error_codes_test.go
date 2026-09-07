package server

import (
	"encoding/json"
	"github.com/gin-gonic/gin"
	"net/http/httptest"
	"testing"
)

func TestLocalizedErrorResponsePreservesLegacyFields(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cases := []struct {
		status        int
		message, code string
	}{
		{422, "Cannot delete your own account", "SELF_DELETE"},
		{422, "Đánh giá hoặc lý do không hợp lệ. Vui lòng tải lại cấu hình.", "CONFIG_STALE"},
		{502, "Không thể hoàn tất cập nhật. Kiểm tra người dùng trước khi thử lại.", "ACCOUNT_UPDATE_UNCERTAIN"},
		{429, "any wording", "RATE_LIMITED"},
		{503, "internal service detail", "UNAVAILABLE"},
	}
	for _, tc := range cases {
		t.Run(tc.code, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Set("requestId", "test-request")
			fail(c, tc.status, tc.message)
			var body map[string]string
			if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			if w.Code != tc.status || body["code"] != tc.code || body["error"] != tc.message || body["requestId"] != "test-request" {
				t.Fatalf("unexpected response: %d %#v", w.Code, body)
			}
		})
	}
}
func TestImportErrorCodes(t *testing.T) {
	for _, message := range []string{"Thiếu staff code hoặc mã quá dài", "Họ tên phải có 2–100 ký tự", "Staff code trùng trong file", "Staff code đã tồn tại", "Cinema code không tồn tại hoặc không hoạt động", "Không có quyền truy cập rạp", "Quản lý không tồn tại, bị khoá hoặc không thuộc rạp này"} {
		if code := importErrorCode(message); code == "VALIDATION" || code == "" {
			t.Fatalf("missing code for %q", message)
		}
	}
}
