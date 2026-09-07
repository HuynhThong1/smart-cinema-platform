package server

// errorCode adds a stable machine-readable code while preserving legacy error text.
func errorCode(status int, message string) string {
	switch message {
	case "Cannot delete your own account":
		return "SELF_DELETE"
	case "Cannot remove your own administrator access":
		return "SELF_DEMOTE"
	case "Temporary password must have at least 12 characters":
		return "PASSWORD_SHORT"
	case "Valid email required":
		return "EMAIL_INVALID"
	case "Assign an active cinema", "Active cinema required":
		return "ACTIVE_CINEMA"
	case "Tài khoản quản lý không còn tồn tại. Chọn quản lý khác hoặc bỏ gán.", "Chọn quản lý đang hoạt động cùng rạp":
		return "MANAGER_INVALID"
	case "Đánh giá hoặc lý do không hợp lệ. Vui lòng tải lại cấu hình.":
		return "CONFIG_STALE"
	case "Vui lòng kiểm tra họ tên, số điện thoại, bình luận và đồng ý bảo mật":
		return "FEEDBACK_INVALID"
	case "CSV or XLSX file required (maximum 5 MB)", "Maximum file size is 5 MB", "Only .csv and .xlsx are supported":
		return "FILE_SIZE"
	case "File must contain a header and 1–1000 valid rows":
		return "IMPORT_ROWS"
	case "Headers must be Staff Code, Full Name, Cinema Code", "Fourth header must be Manager Username":
		return "IMPORT_HEADERS"
	case "Closed coaching cannot be reopened":
		return "COACHING_CLOSED"
	case "Invalid coaching transition":
		return "COACHING_TRANSITION"
	case "Staff must be active":
		return "STAFF_INACTIVE"
	case "Narrow filters to at most 10000 records", "Select a cinema with at most 1000 staff per batch", "Select a smaller cinema scope":
		return "SCOPE_TOO_LARGE"
	case "Không thể hoàn tất cập nhật. Kiểm tra người dùng trước khi thử lại.":
		return "ACCOUNT_UPDATE_UNCERTAIN"
	case "Không thể xóa người dùng. Kiểm tra tài khoản trước khi thử lại.":
		return "ACCOUNT_DELETE_UNCERTAIN"
	}
	switch status {
	case 401:
		return "UNAUTHORIZED"
	case 403:
		return "FORBIDDEN"
	case 404:
		return "NOT_FOUND"
	case 409:
		return "CONFLICT"
	case 400, 422:
		return "VALIDATION"
	case 413:
		return "FILE_SIZE"
	case 429:
		return "RATE_LIMITED"
	case 502, 503:
		return "UNAVAILABLE"
	default:
		return "UNKNOWN"
	}
}

func importErrorCode(message string) string {
	switch message {
	case "Thiếu staff code hoặc mã quá dài":
		return "IMPORT_STAFF_CODE"
	case "Họ tên phải có 2–100 ký tự":
		return "IMPORT_NAME"
	case "Staff code trùng trong file":
		return "IMPORT_DUPLICATE_FILE"
	case "Staff code đã tồn tại":
		return "IMPORT_DUPLICATE"
	case "Cinema code không tồn tại hoặc không hoạt động":
		return "IMPORT_CINEMA"
	case "Không có quyền truy cập rạp":
		return "IMPORT_SCOPE"
	case "Quản lý không tồn tại, bị khoá hoặc không thuộc rạp này":
		return "IMPORT_MANAGER"
	default:
		return "VALIDATION"
	}
}
