/* ============================================================
   نظام إدارة الإجازات - شئون العاملين - جامعة الإسكندرية
   الإصدار v7 - مربوط بـ Google Sheets Backend
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {

    // ====================== الإعدادات الثابتة ======================
    const CASUAL_DAYS = 7;
    const SICK_DAYS = 30;
    const ADMIN_USERNAME = 'admin';
    const ADMIN_PASSWORD = 'admin123';
    const VACATION_PAGE_SIZE = 50;
    const MAX_AUTO_BACKUPS = 10;
    const SYNC_INTERVAL_MS = 30000;

    const DEFAULT_HOLIDAYS = [
        { date: '2026-01-01', name: 'رأس السنة' },
        { date: '2026-05-01', name: 'عيد العمال' },
        { date: '2026-10-06', name: 'عيد القوات المسلحة' },
        { date: '2026-12-25', name: 'عيد الميلاد' }
    ];

    const DEFAULT_SHORTCUTS = {
        help:        { keys: ['Ctrl', '/'],          label_ar: 'عرض قائمة الاختصارات',       label_en: 'Show shortcuts help',  icon: '❓' },
        sidebar:     { keys: ['Alt', 'S'],           label_ar: 'فتح/إغلاق القائمة الجانبية', label_en: 'Toggle sidebar',       icon: '☰' },
        save:        { keys: ['Ctrl', 'S'],          label_ar: 'حفظ البيانات',                label_en: 'Save data',            icon: '💾' },
        sync:        { keys: ['Ctrl', 'R'],          label_ar: 'مزامنة مع الخادم',            label_en: 'Sync with server',     icon: '🔄' },
        logout:      { keys: ['Ctrl', 'Q'],          label_ar: 'تسجيل الخروج',                label_en: 'Logout',               icon: '🚪' },
        prevSection: { keys: ['Alt', 'ArrowUp'],     label_ar: 'القسم السابق',                label_en: 'Previous section',     icon: '⬆️' },
        nextSection: { keys: ['Alt', 'ArrowDown'],   label_ar: 'القسم التالي',                label_en: 'Next section',         icon: '⬇️' },
        prevTab:     { keys: ['Alt', 'ArrowLeft'],   label_ar: 'التبويب السابق',              label_en: 'Previous tab',         icon: '⬅️' },
        nextTab:     { keys: ['Alt', 'ArrowRight'],  label_ar: 'التبويب التالي',              label_en: 'Next tab',             icon: '➡️' }
    };

    const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'input'];

    // ====================== المتغيرات العامة ======================
    let users = {};
    let vacations = [];
    let requests = [];
    let permissions = [];
    let holidays = [];
    let auditLog = [];

    let currentUser = null;
    let isAdmin = false;
    let undoStack = [];
    let redoStack = [];

    let selectedFiscalYear = 'all';
    let searchFiscalYear = 'all';
    let summaryFiscalYear = 'all';
    let summaryFilter = '';
    let auditFilter = '';

    let saturdayOff = true;
    let darkMode = false;
    let hijriEnabled = false;
    let whatsappNumber = '';
    let autoSyncEnabled = true;

    let vacationDisplayLimit = VACATION_PAGE_SIZE;
    let currentLang = localStorage.getItem('lang') || 'ar';
    let currentSection = 'user-panel';

    let typeChartInstance, monthlyChartInstance, yearlyChartInstance;
    let customShortcuts = {};
    let navHudTimer = null;

    let sessionTimeoutEnabled = false;
    let sessionDurationMinutes = 30;
    let sessionWarningMinutes = 2;
    let sessionTimer = null;
    let sessionWarningTimer = null;
    let sessionCountdownInterval = null;
    let lastActivityTime = Date.now();
    let sessionWarningShown = false;
    let lastActivityThrottle = 0;

    let autoBackupEnabled = false;
    let backupFrequency = 'daily';
    let autoBackupTimer = null;

    let syncInterval = null;
    let isSyncing = false;
    let lastSyncTime = 0;
    let connectionOnline = true;

    // ====================== الترجمة (i18n) ======================
    const TRANSLATIONS = {
        ar: {
            translation: {
                app_name: "شئون العاملين", app_university: "جامعة الإسكندرية",
                main_menu: "القائمة الرئيسية",
                group_user: "👤 المستخدم", group_admin: "🛡️ المشرف", group_general: "⚙️ عام",
                settings_label: "الإعدادات", backup_label: "النسخ الاحتياطي",
                login: "تسجيل الدخول", username: "اسم المستخدم", password: "كلمة المرور",
                enter: "دخول", create_account: "إنشاء حساب جديد", new_user: "مستخدم جديد",
                name: "الاسم", birthdate: "تاريخ الميلاد", register: "تسجيل",
                saturday_off: "السبت عطلة",
                enable_auto_sync: "🔄 المزامنة التلقائية كل 30 ثانية",
                user_panel: "لوحة المستخدم", age: "العمر", years: "سنة",
                allocated_regular: "اعتيادية مخصصة", remaining_regular: "متبقي اعتيادية",
                remaining_casual: "متبقي عارضة", remaining_sick: "متبقي مرضية",
                unlimited_types: "أنواع غير محدودة: وضع، رعاية طفل، غير مدفوعة",
                edit_my_data: "تعديل بياناتي", delete_my_account: "حذف حسابي",
                manage_users: "إدارة المستخدمين", add: "إضافة", update: "تحديث",
                cancel: "إلغاء", all_users: "جميع المستخدمين", toggle_list: "إظهار/إخفاء القائمة",
                new_vacation: "تسجيل إجازة جديدة", vacation_type: "نوع الإجازة",
                regular: "اعتيادية", casual: "عارضة", sick: "مرضية",
                maternity: "وضع", childcare: "رعاية طفل", unpaid: "غير مدفوعة",
                add_range: "إضافة نطاق (من - إلى)", add_range_btn: "إضافة النطاق",
                add_single_dates: "أو إضافة تواريخ فردية", add_another_date: "+ تاريخ آخر",
                submit_vacation: "📨 تقديم طلب الإجازة",
                my_requests: "📋 طلباتي", pending_requests: "⏳ طلبات بانتظار الموافقة",
                permissions: "⏰ الأذونات (ساعتان - مرة واحدة أسبوعياً)",
                permission_type: "نوع الأذن", morning: "صباحي", evening: "مسائي",
                permission_date: "تاريخ الأذن", submit_permission: "تسجيل الأذن",
                my_permissions: "أذوناتي", date: "التاريخ", type: "النوع",
                duration: "المدة", delete: "حذف", two_hours: "ساعتان",
                holidays: "🎉 إدارة العطلات الرسمية", holiday_name: "اسم العطلة",
                holiday_date: "التاريخ", no_holidays: "لا توجد عطلات",
                audit_log: "📜 سجل التدقيق", clear_log: "مسح السجل",
                filter_audit: "تصفية (اسم المستخدم / الحدث)",
                datetime: "التاريخ والوقت", actor: "المنفّذ", event: "الحدث", details: "التفاصيل",
                vacation_log: "سجل الإجازات", fiscal_year: "السنة المالية", all_years: "الكل",
                undo: "↩ تراجع", redo: "↪ إعادة", save: "💾 حفظ",
                force_sync: "🔄 مزامنة الخادم",
                export_excel: "📊 Excel", export_pdf: "📄 PDF", save_as: "📁 JSON",
                import: "📂 استيراد", logout: "🚪 خروج",
                search_user: "بحث عن مستخدم", search: "بحث",
                reports: "📊 التقارير والإحصائيات", print_report: "🖨️ طباعة التقرير",
                type_distribution: "توزيع أنواع الإجازات", monthly_vacations: "الإجازات الشهرية",
                yearly_accumulation: "📈 تراكم الإجازات عبر السنوات المالية",
                admin_summary: "👥 ملخص عام للموظفين", print_summary: "🖨️ طباعة الملخص",
                total_users: "إجمالي الموظفين", total_vacations: "إجمالي الإجازات",
                pending_count: "قيد المراجعة", total_permissions: "إجمالي الأذونات",
                top_users: "🏆 أعلى الموظفين في استخدام الإجازات",
                rank: "#", employee: "الموظف", total_days: "إجمالي الأيام",
                detailed_balances: "📋 الأرصدة التفصيلية",
                search_by_name: "بحث باسم الموظف",
                th_alloc_regular: "اعتيادي (مخصص)", th_used_regular: "اعتيادي (مستخدم)", th_remain_regular: "اعتيادي (متبقي)",
                th_used_casual: "عارضة (مستخدم)", th_remain_casual: "عارضة (متبقي)",
                th_used_sick: "مرضية (مستخدم)", th_remain_sick: "مرضية (متبقي)",
                th_perms: "أذونات",
                export_settings: "⚙️ تصدير الإعدادات", import_settings: "📥 استيراد الإعدادات",
                enable_hijri: "📅 التقويم الهجري", whatsapp_notify: "📱 إشعار واتساب",
                whatsapp_number: "رقم الواتساب (اختياري)", save_number: "حفظ الرقم",
                whatsapp_hint: "عند اعتماد أو رفض طلب إجازة، سيُفتح واتساب برسالة جاهزة لإرسالها للموظف.",
                whatsapp_note: "⚠️ أدخل الرقم بالصيغة الدولية بدون + أو 00.",
                server_settings: "🌐 إعدادات الخادم",
                server_hint: "إعدادات الاتصال بـ Google Sheets Backend",
                api_url: "رابط الـ API (Google Apps Script)",
                api_token: "رمز المصادقة (Token)",
                test_connection: "🧪 اختبار الاتصال",
                connection_ok: "✅ متصل بالخادم",
                connection_fail: "❌ فشل الاتصال بالخادم",
                connection_testing: "⏳ جارٍ اختبار الاتصال...",
                api_saved: "تم حفظ إعدادات الخادم",
                api_url_required: "أدخل رابط الـ API",
                token_required: "أدخل رمز المصادقة",
                sync_started: "جارٍ المزامنة...",
                sync_done: "تمت المزامنة بنجاح",
                sync_failed: "فشلت المزامنة",
                sync_offline: "أنت غير متصل بالإنترنت",
                online: "متصل",
                offline: "غير متصل",
                pending: "قيد المراجعة", approved: "معتمد", rejected: "مرفوض",
                request_submitted_at: "تاريخ التقديم", review_note: "📝 ملاحظة المشرف",
                cancel_request: "إلغاء الطلب", approve: "✅ اعتماد", reject: "❌ رفض",
                days_count: "يوم", no_requests: "لا توجد طلبات سابقة.",
                no_pending: "لا توجد طلبات بانتظار الموافقة.",
                saved: "تم حفظ البيانات بنجاح", imported: "تم الاستيراد بنجاح",
                invalid_file: "ملف غير صالح", enter_all_fields: "املأ جميع الحقول",
                user_exists: "اسم المستخدم موجود", user_not_found: "لم يتم العثور على المستخدم.",
                wrong_credentials: "اسم المستخدم أو كلمة المرور غير صحيحة",
                registered: "تم التسجيل بنجاح. يمكنك تسجيل الدخول الآن.",
                birthdate_future: "تاريخ الميلاد لا يمكن أن يكون في المستقبل",
                select_dates: "اختر تاريخ البداية والنهاية",
                end_before_start: "تاريخ النهاية قبل البداية",
                add_at_least_one: "أضف تاريخاً واحداً على الأقل",
                date_conflict: "التاريخ {date} مسجل مسبقاً.",
                balance_insufficient: "رصيدك {type} للسنة {year} غير كاف (المتبقي {remaining})",
                low_balance: "تنبيه: رصيدك الاعتيادي المتبقي {days} أيام فقط.",
                not_working_day: "التاريخ ليس يوم عمل",
                permission_weekly_limit: "لديك أذن مسجّل في نفس الأسبوع. مرة واحدة فقط أسبوعياً.",
                permission_added: "تم تسجيل الأذن", holiday_added: "تمت إضافة العطلة",
                holiday_exists: "هذا التاريخ مسجّل كعطلة مسبقاً",
                request_submitted: "تم تقديم الطلب بانتظار الموافقة",
                request_approved: "تم اعتماد الطلب بنجاح",
                request_rejected: "تم رفض الطلب",
                self_approved: "تم تسجيل الإجازة مباشرة",
                note_optional: "ملاحظة (اختياري):", reject_reason: "سبب الرفض (اختياري):",
                ok: "موافق", yes: "نعم", no: "لا", alert: "تنبيه", confirm: "تأكيد",
                error: "خطأ", success: "نجاح", info: "معلومة", no_data: "لا توجد بيانات",
                lang_changed: "تم تغيير اللغة", hijri_enabled: "تم تفعيل التقويم الهجري",
                hijri_disabled: "تم إلغاء التقويم الهجري", no_whatsapp_number: "لم يتم تعيين رقم واتساب",
                admin_dashboard: "لوحة المشرف", admin_employees: "الموظفون",
                admin_reports: "التقارير", admin_settings: "إعدادات متقدمة",
                quick_stats: "إحصائيات سريعة",
                customize_shortcuts: "⌨️ تخصيص اختصارات لوحة المفاتيح",
                reset_shortcuts: "↺ إعادة للافتراضي",
                shortcut_edit_hint: "اضغط على أي اختصار لتحريره، ثم اضغط تركيبة المفاتيح الجديدة.",
                shortcut_hint_text: "اضغط Ctrl + / لعرض كل اختصارات لوحة المفاتيح، أو اضغط أيقونة ⌨️ في الأعلى.",
                shortcut_saved: "تم حفظ الاختصار",
                shortcut_conflict: "الاختصار مستخدم في وظيفة أخرى",
                shortcuts_reset: "تمت إعادة الاختصارات للافتراضي",
                recording_shortcut: "🎯 اضغط تركيبة المفاتيح الجديدة...",
                press_keys: "اضغط المفاتيح...",
                restored_location: "تم استرجاع آخر موقع لك في التطبيق",
                keyboard_shortcuts: "⌨️ اختصارات لوحة المفاتيح",
                shortcut_col: "الاختصار", action_col: "الوظيفة",
                session_settings: "⏱️ إعدادات الجلسة",
                enable_session_timeout: "تفعيل انتهاء الجلسة التلقائي",
                session_duration: "مدة الجلسة (دقائق):",
                warning_before: "التنبيه قبل الانتهاء (دقائق):",
                auto_backup_settings: "🔄 النسخ الاحتياطي التلقائي",
                enable_auto_backup: "تفعيل النسخ الاحتياطي التلقائي",
                backup_frequency: "التكرار:",
                freq_daily: "يومياً", freq_weekly: "أسبوعياً", freq_hourly: "كل ساعة",
                backup_now: "نسخ الآن",
                view_backups: "📂 عرض النسخ المحفوظة",
                download_latest: "⬇️ تحميل أحدث نسخة",
                session_warning_title: "⚠️ جلستك على وشك الانتهاء",
                session_warning_msg: "سيتم تسجيل خروجك تلقائياً خلال",
                seconds: "ثانية",
                extend_session: "🔄 تمديد الجلسة",
                session_extended: "تم تمديد الجلسة",
                session_expired: "تم تسجيل الخروج تلقائياً لانتهاء مدة الجلسة",
                auto_backup_enabled: "تم تفعيل النسخ التلقائي",
                auto_backup_disabled: "تم إيقاف النسخ التلقائي",
                backup_created: "تم إنشاء نسخة احتياطية",
                backup_failed: "فشل النسخ الاحتياطي",
                no_backups: "لا توجد نسخ احتياطية محفوظة",
                backups_title: "📂 النسخ الاحتياطية المحفوظة",
                restore_confirm: "سيتم استبدال جميع البيانات الحالية بهذه النسخة. هل أنت متأكد؟",
                restored_success: "تم الاسترجاع بنجاح",
                deleted: "تم الحذف",
                backup_deleted: "حذف هذه النسخة؟",
                backup_status: "الحالة",
                backup_last_auto: "آخر نسخة تلقائية",
                backup_saved_count: "النسخ المحفوظة",
                backup_enabled: "✅ مفعّل",
                backup_disabled_state: "⭕ معطّل",
                backup_none: "لا يوجد",
                backup_auto_label: "تلقائي",
                backup_manual_label: "يدوي",
                users_label: "الموظفون",
                leaves_label: "الإجازات",
                latest_downloaded: "تم تحميل أحدث نسخة",
                new_request_notification: "📨 لديك طلب إجازة جديد!",
                data_updated: "تم تحديث البيانات من الخادم"
            }
        },
        en: {
            translation: {
                app_name: "HR Department", app_university: "Alexandria University",
                main_menu: "Main Menu",
                group_user: "👤 User", group_admin: "🛡️ Admin", group_general: "⚙️ General",
                settings_label: "Settings", backup_label: "Backup & Import",
                login: "Login", username: "Username", password: "Password",
                enter: "Enter", create_account: "Create New Account", new_user: "New User",
                name: "Name", birthdate: "Birthdate", register: "Register",
                saturday_off: "Saturday Off",
                enable_auto_sync: "🔄 Auto sync every 30 seconds",
                user_panel: "User Panel", age: "Age", years: "years",
                allocated_regular: "Allocated Regular", remaining_regular: "Remaining Regular",
                remaining_casual: "Remaining Casual", remaining_sick: "Remaining Sick",
                unlimited_types: "Unlimited: Maternity, Childcare, Unpaid",
                edit_my_data: "Edit My Data", delete_my_account: "Delete My Account",
                manage_users: "Manage Users", add: "Add", update: "Update",
                cancel: "Cancel", all_users: "All Users", toggle_list: "Toggle List",
                new_vacation: "New Leave Request", vacation_type: "Leave Type",
                regular: "Regular", casual: "Casual", sick: "Sick",
                maternity: "Maternity", childcare: "Childcare", unpaid: "Unpaid",
                add_range: "Add Range (From - To)", add_range_btn: "Add Range",
                add_single_dates: "Or Add Single Dates", add_another_date: "+ Another Date",
                submit_vacation: "📨 Submit Leave Request",
                my_requests: "📋 My Requests", pending_requests: "⏳ Pending Approval",
                permissions: "⏰ Permissions (2 Hours - Once Weekly)",
                permission_type: "Permission Type", morning: "Morning", evening: "Evening",
                permission_date: "Permission Date", submit_permission: "Submit Permission",
                my_permissions: "My Permissions", date: "Date", type: "Type",
                duration: "Duration", delete: "Delete", two_hours: "2 Hours",
                holidays: "🎉 Manage Public Holidays", holiday_name: "Holiday Name",
                holiday_date: "Date", no_holidays: "No holidays",
                audit_log: "📜 Audit Log", clear_log: "Clear Log",
                filter_audit: "Filter (username / action)",
                datetime: "Date & Time", actor: "Actor", event: "Event", details: "Details",
                vacation_log: "Leave History", fiscal_year: "Fiscal Year", all_years: "All",
                undo: "↩ Undo", redo: "↪ Redo", save: "💾 Save",
                force_sync: "🔄 Sync Server",
                export_excel: "📊 Excel", export_pdf: "📄 PDF", save_as: "📁 JSON",
                import: "📂 Import", logout: "🚪 Logout",
                search_user: "Search User", search: "Search",
                reports: "📊 Reports & Statistics", print_report: "🖨️ Print Report",
                type_distribution: "Leave Type Distribution", monthly_vacations: "Monthly Leaves",
                yearly_accumulation: "📈 Leave Accumulation by Fiscal Year",
                admin_summary: "👥 Employee Summary", print_summary: "🖨️ Print Summary",
                total_users: "Total Employees", total_vacations: "Approved Leaves",
                pending_count: "Pending", total_permissions: "Total Permissions",
                top_users: "🏆 Top Employees by Leave Usage",
                rank: "#", employee: "Employee", total_days: "Total Days",
                detailed_balances: "📋 Detailed Balances",
                search_by_name: "Search by name",
                th_alloc_regular: "Reg. (Alloc)", th_used_regular: "Reg. (Used)", th_remain_regular: "Reg. (Left)",
                th_used_casual: "Casual (Used)", th_remain_casual: "Casual (Left)",
                th_used_sick: "Sick (Used)", th_remain_sick: "Sick (Left)",
                th_perms: "Perms",
                export_settings: "⚙️ Export Settings", import_settings: "📥 Import Settings",
                enable_hijri: "📅 Hijri Calendar", whatsapp_notify: "📱 WhatsApp Notification",
                whatsapp_number: "WhatsApp Number (optional)", save_number: "Save Number",
                whatsapp_hint: "When a leave request is approved or rejected, WhatsApp will open with a ready message.",
                whatsapp_note: "⚠️ Enter number in international format without + or 00.",
                server_settings: "🌐 Server Settings",
                server_hint: "Google Sheets Backend connection settings",
                api_url: "API URL (Google Apps Script)",
                api_token: "Auth Token",
                test_connection: "🧪 Test Connection",
                connection_ok: "✅ Connected to server",
                connection_fail: "❌ Server connection failed",
                connection_testing: "⏳ Testing connection...",
                api_saved: "Server settings saved",
                api_url_required: "Enter API URL",
                token_required: "Enter auth token",
                sync_started: "Syncing...",
                sync_done: "Sync completed",
                sync_failed: "Sync failed",
                sync_offline: "You are offline",
                online: "Online",
                offline: "Offline",
                pending: "Pending", approved: "Approved", rejected: "Rejected",
                request_submitted_at: "Submitted at", review_note: "📝 Supervisor note",
                cancel_request: "Cancel Request", approve: "✅ Approve", reject: "❌ Reject",
                days_count: "days", no_requests: "No previous requests.",
                no_pending: "No pending requests.",
                saved: "Saved successfully", imported: "Imported successfully",
                invalid_file: "Invalid file", enter_all_fields: "Fill all fields",
                user_exists: "Username already exists", user_not_found: "User not found.",
                wrong_credentials: "Wrong username or password",
                registered: "Registered successfully. You can login now.",
                birthdate_future: "Birthdate cannot be in the future",
                select_dates: "Select start and end dates",
                end_before_start: "End date is before start date",
                add_at_least_one: "Add at least one date",
                date_conflict: "Date {date} already registered.",
                balance_insufficient: "Your {type} balance for year {year} is insufficient (remaining {remaining})",
                low_balance: "Warning: Your remaining regular balance is only {days} days.",
                not_working_day: "Not a working day",
                permission_weekly_limit: "You already have a permission this week. Only once weekly.",
                permission_added: "Permission registered", holiday_added: "Holiday added",
                holiday_exists: "Date already a holiday",
                request_submitted: "Request submitted for approval",
                request_approved: "Request approved",
                request_rejected: "Request rejected",
                self_approved: "Leave registered directly",
                note_optional: "Note (optional):", reject_reason: "Rejection reason (optional):",
                ok: "OK", yes: "Yes", no: "No", alert: "Alert", confirm: "Confirm",
                error: "Error", success: "Success", info: "Info", no_data: "No data",
                lang_changed: "Language changed", hijri_enabled: "Hijri calendar enabled",
                hijri_disabled: "Hijri calendar disabled", no_whatsapp_number: "No WhatsApp number set",
                admin_dashboard: "Admin Dashboard", admin_employees: "Employees",
                admin_reports: "Reports", admin_settings: "Advanced Settings",
                quick_stats: "Quick Stats",
                customize_shortcuts: "⌨️ Customize Keyboard Shortcuts",
                reset_shortcuts: "↺ Reset to Default",
                shortcut_edit_hint: "Click any shortcut to edit, then press the new key combination.",
                shortcut_hint_text: "Press Ctrl + / to show all shortcuts, or click the ⌨️ icon above.",
                shortcut_saved: "Shortcut saved",
                shortcut_conflict: "Shortcut is used by another action",
                shortcuts_reset: "Shortcuts reset to defaults",
                recording_shortcut: "🎯 Press the new key combination...",
                press_keys: "Press keys...",
                restored_location: "Restored your last location",
                keyboard_shortcuts: "⌨️ Keyboard Shortcuts",
                shortcut_col: "Shortcut", action_col: "Action",
                session_settings: "⏱️ Session Settings",
                enable_session_timeout: "Enable automatic session timeout",
                session_duration: "Session duration (minutes):",
                warning_before: "Warning before expiry (minutes):",
                auto_backup_settings: "🔄 Automatic Backup",
                enable_auto_backup: "Enable automatic backup",
                backup_frequency: "Frequency:",
                freq_daily: "Daily", freq_weekly: "Weekly", freq_hourly: "Hourly",
                backup_now: "Backup Now",
                view_backups: "📂 View Saved Backups",
                download_latest: "⬇️ Download Latest",
                session_warning_title: "⚠️ Session About to Expire",
                session_warning_msg: "You will be logged out automatically in",
                seconds: "seconds",
                extend_session: "🔄 Extend Session",
                session_extended: "Session extended",
                session_expired: "You were logged out due to session timeout",
                auto_backup_enabled: "Auto backup enabled",
                auto_backup_disabled: "Auto backup disabled",
                backup_created: "Backup created",
                backup_failed: "Backup failed",
                no_backups: "No backups saved",
                backups_title: "📂 Saved Backups",
                restore_confirm: "All current data will be replaced. Are you sure?",
                restored_success: "Restored successfully",
                deleted: "Deleted",
                backup_deleted: "Delete this backup?",
                backup_status: "Status",
                backup_last_auto: "Last auto backup",
                backup_saved_count: "Saved backups",
                backup_enabled: "✅ Enabled",
                backup_disabled_state: "⭕ Disabled",
                backup_none: "None",
                backup_auto_label: "Auto",
                backup_manual_label: "Manual",
                users_label: "Users",
                leaves_label: "Leaves",
                latest_downloaded: "Latest backup downloaded",
                new_request_notification: "📨 You have a new leave request!",
                data_updated: "Data updated from server"
            }
        }
    };

    function t(key, vars = {}) {
        let str = (window.i18next && i18next.t) ? i18next.t(key) : (TRANSLATIONS[currentLang].translation[key] || key);
        Object.keys(vars).forEach(k => { str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), vars[k]); });
        return str;
    }

    function initI18n() {
        return i18next.init({
            lng: currentLang, fallbackLng: 'ar', resources: TRANSLATIONS
        }).then(() => applyTranslations());
    }

    function applyTranslations() {
        document.body.classList.toggle('lang-en', currentLang === 'en');
        document.documentElement.lang = currentLang;
        document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = t(key);
            } else {
                el.textContent = t(key);
            }
        });

        const darkBtn = document.getElementById('dark-mode-toggle');
        if (darkBtn) darkBtn.textContent = darkMode ? '☀️' : '🌙';

        if (monthlyChartInstance) {
            monthlyChartInstance.data.labels = currentLang === 'ar'
                ? ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
                : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            monthlyChartInstance.update();
        }

        renderShortcutsEditor();
        updateBackupStatus();
        updateApiStatusDisplay();

        if (currentUser) refreshUI();
    }

    function toggleLanguage() {
        currentLang = currentLang === 'ar' ? 'en' : 'ar';
        localStorage.setItem('lang', currentLang);
        i18next.changeLanguage(currentLang).then(() => {
            applyTranslations();
            showToast(t('lang_changed'), 'success');
        });
    }

    // ====================== Modal ======================
    function showModal({ title = '', message = '', icon = '', input = false,
                         defaultValue = '', okText = 'موافق', cancelText = 'إلغاء',
                         showCancel = false, okClass = 'btn-primary',
                         onRender = null, closeOnOk = true, closeOnCancel = true }) {
        return new Promise((resolve) => {
            const root = document.getElementById('modal-root');
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            const inputHTML = input
                ? `<input type="text" class="modal-input" value="${String(defaultValue).replace(/"/g,'&quot;')}">`
                : '';
            overlay.innerHTML = `
                <div class="modal-box" role="dialog" aria-modal="true">
                    ${icon ? `<div class="modal-icon">${icon}</div>` : ''}
                    ${title ? `<div class="modal-title">${title}</div>` : ''}
                    ${message ? `<div class="modal-message">${message}</div>` : ''}
                    ${inputHTML}
                    <div class="modal-actions">
                        ${showCancel ? `<button class="btn btn-secondary modal-cancel">${cancelText}</button>` : ''}
                        <button class="btn ${okClass} modal-ok">${okText}</button>
                    </div>
                </div>`;
            root.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add('show'));

            const inputEl = overlay.querySelector('.modal-input');
            if (inputEl) setTimeout(() => { inputEl.focus(); inputEl.select(); }, 100);

            const close = (value) => {
                overlay.classList.remove('show');
                setTimeout(() => { overlay.remove(); resolve(value); }, 200);
            };
            overlay.querySelector('.modal-ok').addEventListener('click', () => {
                if (closeOnOk) close(input ? inputEl.value : true);
            });
            const cancelBtn = overlay.querySelector('.modal-cancel');
            if (cancelBtn) cancelBtn.addEventListener('click', () => {
                if (closeOnCancel) close(input ? null : false);
            });
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay && showCancel && closeOnCancel) close(input ? null : false);
            });

            if (onRender) onRender(overlay, close);
        });
    }

    const showAlert = (message, title = null, icon = 'ℹ️') =>
        showModal({ title: title || t('alert'), message, icon, okText: t('ok') });

    const showConfirm = (message, title = null, icon = '❓', okClass = 'btn-danger') =>
        showModal({ title: title || t('confirm'), message, icon, showCancel: true,
                    okText: t('yes'), cancelText: t('no'), okClass });

    const showPrompt = (message, defaultValue = '', title = null, icon = '✏️') =>
        showModal({ title: title || '', message, icon, input: true, defaultValue,
                    showCancel: true, okText: t('ok'), cancelText: t('cancel') });

    // ====================== Toast ======================
    function showToast(message, type = 'info', duration = 4000) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };
        toast.innerHTML = `<span class="toast-icon">${icons[type] || ''}</span><span>${message}</span>`;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    function showNotification(msg) { showToast(msg, 'warning', 8000); }

    // ====================== HUD ======================
    function showNavHud(icon, title, subtitle = '') {
        const hud = document.getElementById('nav-hud');
        if (!hud) return;
        hud.querySelector('.nav-hud-icon').textContent = icon;
        hud.querySelector('.nav-hud-title').textContent = title;
        hud.querySelector('.nav-hud-subtitle').textContent = subtitle;
        hud.setAttribute('aria-hidden', 'false');
        hud.classList.add('show');

        if (navHudTimer) clearTimeout(navHudTimer);
        navHudTimer = setTimeout(() => {
            hud.classList.remove('show');
            hud.setAttribute('aria-hidden', 'true');
        }, 1200);
    }

    function showConnectionStatus(status, message = '') {
        const el = document.getElementById('connection-status');
        if (!el) return;
        el.className = 'connection-status show ' + status;
        el.querySelector('.connection-icon').textContent =
            status === 'online' ? '🟢' : (status === 'syncing' ? '🔄' : '🔴');
        el.querySelector('.connection-text').textContent =
            message || (status === 'online' ? t('online') : t('offline'));
        el.setAttribute('aria-hidden', 'false');

        if (status === 'online') {
            setTimeout(() => {
                el.classList.remove('show');
                el.setAttribute('aria-hidden', 'true');
            }, 2000);
        }
    }

    // ====================== دوال مساعدة ======================
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function getWorkDays() {
        const base = [0, 1, 2, 3, 4];
        if (!saturdayOff) base.push(6);
        return base;
    }

    function calculateAge(birthdate) {
        const today = new Date();
        const b = new Date(birthdate);
        let age = today.getFullYear() - b.getFullYear();
        if (today < new Date(b.setFullYear(today.getFullYear()))) age--;
        return age;
    }

    function isWorkingDay(dateStr) {
        const d = new Date(dateStr);
        const day = d.getDay();
        const workDays = getWorkDays();
        return workDays.includes(day) && !holidays.some(h => h.date === dateStr);
    }

    function getAllocatedDays(birthdate) {
        return calculateAge(birthdate) >= 50 ? 45 : 30;
    }

    function getWeekKey(dateStr) {
        const d = new Date(dateStr);
        const day = d.getDay();
        const diff = (day + 1) % 7;
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - diff);
        return weekStart.toISOString().slice(0, 10);
    }

    function getFiscalYear(dateStr) {
        const d = new Date(dateStr);
        const year = d.getFullYear();
        const month = d.getMonth();
        return month >= 6 ? year : year - 1;
    }
    function getFiscalYearLabel(fy) { return `${fy} - ${fy + 1}`; }

    function getAvailableFiscalYears() {
        const years = new Set();
        vacations.forEach(v => years.add(getFiscalYear(v.date)));
        requests.forEach(r => r.dates.forEach(d => years.add(getFiscalYear(d))));
        permissions.forEach(p => years.add(getFiscalYear(p.date)));
        years.add(getFiscalYear(new Date().toISOString().slice(0, 10)));
        return Array.from(years).sort((a, b) => b - a);
    }

    function populateFiscalYearFilter(selectElement, selectedValue) {
        if (!selectElement) return;
        const available = getAvailableFiscalYears();
        selectElement.innerHTML = `<option value="all">${t('all_years')}</option>`;
        available.forEach(fy => {
            const option = document.createElement('option');
            option.value = fy;
            option.textContent = getFiscalYearLabel(fy);
            selectElement.appendChild(option);
        });
        selectElement.value = selectedValue;
    }

    function filterVacationsByYear(year) {
        if (year === 'all') return vacations;
        return vacations.filter(v => getFiscalYear(v.date) === Number(year));
    }

    function toHijri(dateStr) {
        try {
            const d = new Date(dateStr);
            const hijri = new HijriDate(d);
            return `${hijri.getDate()}/${hijri.getMonth() + 1}/${hijri.getFullYear()} هـ`;
        } catch { return ''; }
    }

    function applyHijri(enabled) {
        hijriEnabled = enabled;
        localStorage.setItem('hijriEnabled', enabled ? '1' : '0');
        reinitAllFlatpickr();
        showToast(enabled ? t('hijri_enabled') : t('hijri_disabled'), 'info');
    }

    function pushState() {
        undoStack.push({
            users: JSON.parse(JSON.stringify(users)),
            vacations: JSON.parse(JSON.stringify(vacations)),
            requests: JSON.parse(JSON.stringify(requests)),
            permissions: JSON.parse(JSON.stringify(permissions)),
            holidays: JSON.parse(JSON.stringify(holidays))
        });
        if (redoStack.length > 0) redoStack = [];
    }

    // ====================== سجل التدقيق ======================
    const ACTION_LABELS = {
        login: '🔑 دخول', logout: '🚪 خروج', register: '📝 تسجيل مستخدم',
        add_user: '➕ إضافة مستخدم', edit_user: '✏️ تعديل مستخدم', delete_user: '🗑️ حذف مستخدم',
        submit_request: '📨 طلب إجازة', approve_request: '✅ اعتماد طلب', reject_request: '❌ رفض طلب',
        add_permission: '⏰ إضافة أذن', delete_permission: '🗑️ حذف أذن',
        delete_vacation: '🗑️ حذف إجازة', add_holiday: '🎉 إضافة عطلة', delete_holiday: '🗑️ حذف عطلة',
        change_setting: '⚙️ تعديل إعداد', import_data: '📥 استيراد بيانات',
        export_data: '📤 تصدير بيانات', clear_audit: '🧹 مسح السجل'
    };

    async function logAction(action, details = '', actor = null) {
        const entry = {
            id: generateId(),
            timestamp: new Date().toISOString(),
            actor: actor || currentUser || 'system',
            action, details
        };
        auditLog.push(entry);
        if (auditLog.length > 2000) auditLog = auditLog.slice(-2000);

        try { await api.addAudit(entry); } catch (err) { console.warn('Audit log failed:', err); }
    }

    // ====================== واتساب ======================
    function buildWhatsAppLink(phone, message) {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    }

    function openWhatsApp(phone, message) {
        if (!phone) { showToast(t('no_whatsapp_number'), 'warning'); return; }
        window.open(buildWhatsAppLink(phone, message), '_blank');
    }

    function buildApprovalMessage(req) {
        const name = req.username;
        const typeMap = currentLang === 'ar'
            ? { 'اعتيادية':'اعتيادية','عارضة':'عارضة','مرضية':'مرضية','وضع':'وضع','رعاية طفل':'رعاية طفل','غير مدفوعة':'غير مدفوعة' }
            : { 'اعتيادية':'Regular','عارضة':'Casual','مرضية':'Sick','وضع':'Maternity','رعاية طفل':'Childcare','غير مدفوعة':'Unpaid' };
        const type = typeMap[req.type] || req.type;
        if (currentLang === 'ar') {
            return `مرحباً ${name}،\n\nتم *اعتماد* طلب إجازتك:\n📋 النوع: ${type}\n📅 الأيام: ${req.dates.length}\n🗓️ التواريخ: ${req.dates.join(' , ')}\n\n${req.reviewNote ? `📝 ملاحظة: ${req.reviewNote}\n\n` : ''}نتمنى لك إجازة سعيدة! 🌟`;
        }
        return `Hello ${name},\n\nYour leave request has been *APPROVED*:\n📋 Type: ${type}\n📅 Days: ${req.dates.length}\n🗓️ Dates: ${req.dates.join(' , ')}\n\n${req.reviewNote ? `📝 Note: ${req.reviewNote}\n\n` : ''}Enjoy your time off! 🌟`;
    }

    function buildRejectionMessage(req) {
        const name = req.username;
        if (currentLang === 'ar') {
            return `مرحباً ${name}،\n\nنأسف لإبلاغك بأنه تم *رفض* طلب إجازتك:\n📅 التواريخ: ${req.dates.join(' , ')}\n${req.reviewNote ? `\n📝 سبب الرفض: ${req.reviewNote}` : ''}\n\nللاستفسار، يرجى التواصل مع الإدارة.`;
        }
        return `Hello ${name},\n\nYour leave request has been *REJECTED*:\n📅 Dates: ${req.dates.join(' , ')}\n${req.reviewNote ? `\n📝 Reason: ${req.reviewNote}` : ''}\n\nPlease contact management.`;
    }

    async function sendWhatsAppNotification(phone, message) {
        if (!phone) return;
        const ok = await showConfirm(
            currentLang === 'ar'
                ? 'سيُفتح واتساب برسالة جاهزة. هل تريد المتابعة؟'
                : 'WhatsApp will open with a pre-filled message. Continue?',
            t('whatsapp_notify'), '📱', 'btn-success');
        if (ok) openWhatsApp(phone, message);
    }

    // ====================== Flatpickr ======================
    function initFlatpickr(selector) {
        const elements = (typeof selector === 'string')
            ? document.querySelectorAll(selector) : [selector];
        elements.forEach(el => {
            if (el._flatpickr) el._flatpickr.destroy();
            const disableFn = el.classList.contains('datepicker-no-disable')
                ? []
                : [function(date) {
                    const day = date.getDay();
                    const dateStr = flatpickr.formatDate(date, 'Y-m-d');
                    const workDays = getWorkDays();
                    return !workDays.includes(day) || holidays.some(h => h.date === dateStr);
                }];
            flatpickr(el, {
                locale: 'ar',
                dateFormat: 'Y-m-d',
                disable: disableFn,
                onDayCreate: hijriEnabled ? function(dObj, dStr, fp, dayElem) {
                    try {
                        const h = new HijriDate(dayElem.dateObj);
                        const span = document.createElement('span');
                        span.style.cssText = 'display:block;font-size:10px;color:#888;';
                        span.textContent = h.getDate();
                        dayElem.appendChild(span);
                    } catch {}
                } : null
            });
        });
    }

    function reinitAllFlatpickr() {
        document.querySelectorAll('.datepicker, .datepicker-no-disable, .vacation-date').forEach(el => {
            if (el._flatpickr) el._flatpickr.destroy();
        });
        initFlatpickr('.datepicker');
        initFlatpickr('.datepicker-no-disable');
        document.querySelectorAll('.vacation-date').forEach(el => initFlatpickr(el));
    }

    // ====================== عناصر DOM ======================
    const loginSection = document.getElementById('login-section');
    const appContent = document.getElementById('app-content');
    const adminUserForm = document.getElementById('admin-user-form');

    // ====================== التنقل ======================
    function openSidebar() {
        document.getElementById('sidebar').classList.add('open');
        document.getElementById('sidebar-overlay').classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    function closeSidebar() {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebar-overlay').classList.remove('show');
        document.body.style.overflow = '';
    }

    function navigateTo(sectionName, skipSave = false) {
        currentSection = sectionName;

        document.querySelectorAll('#app-content .app-section').forEach(sec => {
            sec.classList.toggle('active', sec.dataset.section === sectionName);
        });

        document.querySelectorAll('.nav-item[data-section]').forEach(item => {
            item.classList.toggle('active', item.dataset.section === sectionName);
        });

        if (sectionName === 'reports') {
            setTimeout(() => { if (typeof updateCharts === 'function') updateCharts(); }, 80);
        }
        if (sectionName === 'admin-dashboard') {
            setTimeout(() => renderAdminSummary(), 50);
        }
        if (sectionName === 'admin-reports') {
            setTimeout(() => {
                renderAdminSummary();
                renderAuditLog();
            }, 50);
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
        closeSidebar();

        if (!skipSave) saveNavState();
    }

    function initNavigation() {
        document.getElementById('menu-toggle').addEventListener('click', openSidebar);
        document.getElementById('sidebar-close').addEventListener('click', closeSidebar);
        document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

        document.querySelectorAll('.nav-item[data-section]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                navigateTo(item.dataset.section);
            });
        });

        const sLogout = document.getElementById('sidebar-logout');
        if (sLogout) sLogout.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
            closeSidebar();
        });
    }

    function initSubTabs() {
        document.querySelectorAll('.app-section').forEach(section => {
            const tabs = section.querySelectorAll('.sub-tab');
            const contents = section.querySelectorAll('.sub-tab-content');
            if (tabs.length === 0) return;

            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const targetTab = tab.dataset.tab;
                    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === targetTab));
                    contents.forEach(c => c.classList.toggle('active', c.dataset.tab === targetTab));
                    saveNavState();
                });
            });
        });
    }

    function goToSubTab(sectionName, tabName, skipSave = false) {
        const section = document.querySelector(`.app-section[data-section="${sectionName}"]`);
        if (!section) return;

        const tabs = section.querySelectorAll('.sub-tab');
        const contents = section.querySelectorAll('.sub-tab-content');

        tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
        contents.forEach(c => c.classList.toggle('active', c.dataset.tab === tabName));

        if (!skipSave) saveNavState();
    }

    const NAV_STATE_KEY = 'vacationApp_navState';

    function saveNavState() {
        if (!currentUser) return;
        const subTabs = {};
        document.querySelectorAll('.app-section').forEach(sec => {
            const activeTab = sec.querySelector('.sub-tab.active');
            if (activeTab) subTabs[sec.dataset.section] = activeTab.dataset.tab;
        });
        const state = { currentSection, subTabs, user: currentUser, timestamp: Date.now() };
        try { localStorage.setItem(NAV_STATE_KEY, JSON.stringify(state)); } catch {}
    }

    function loadNavState() {
        try { return JSON.parse(localStorage.getItem(NAV_STATE_KEY)) || null; }
        catch { return null; }
    }

    function restoreNavState() {
        const state = loadNavState();
        if (!state || !state.currentSection) return false;
        if (state.user && state.user !== currentUser) return false;

        const section = document.querySelector(`.app-section[data-section="${state.currentSection}"]`);
        if (!section) return false;
        if (section.classList.contains('admin-only') && !isAdmin) return false;

        if (state.subTabs) {
            for (const [sec, tab] of Object.entries(state.subTabs)) {
                goToSubTab(sec, tab, true);
            }
        }

        navigateTo(state.currentSection, true);
        setTimeout(() => showToast(t('restored_location'), 'info', 2500), 400);
        return true;
    }

    function clearNavState() {
        try { localStorage.removeItem(NAV_STATE_KEY); } catch {}
    }

    // ====================== الاختصارات ======================
    function normalizeShortcut(keys) {
        if (!Array.isArray(keys)) return '';
        return keys.map(k => k.trim()).sort().join('+').toLowerCase();
    }

    function keysMatchEvent(event, keys) {
        if (!Array.isArray(keys) || keys.length === 0) return false;
        const target = keys.map(k => k.toLowerCase()).sort();
        const actual = [];
        if (event.ctrlKey) actual.push('ctrl');
        if (event.altKey) actual.push('alt');
        if (event.shiftKey) actual.push('shift');
        if (event.metaKey) actual.push('meta');

        let mainKey = event.key || '';
        if (['Control', 'Alt', 'Shift', 'Meta'].includes(mainKey)) return false;
        if (mainKey === ' ') mainKey = 'Space';
        if (mainKey.length === 1) mainKey = mainKey.toLowerCase();
        actual.push(mainKey.toLowerCase());

        if (actual.length !== target.length) return false;
        return actual.sort().every((k, i) => k === target[i]);
    }

    function findConflict(actionName, keys) {
        const normalized = normalizeShortcut(keys);
        for (const [name, config] of Object.entries(customShortcuts)) {
            if (name === actionName) continue;
            if (normalizeShortcut(config.keys) === normalized) return name;
        }
        return null;
    }

    function loadCustomShortcuts() {
        try {
            const stored = JSON.parse(localStorage.getItem('customShortcuts'));
            if (stored && typeof stored === 'object') {
                customShortcuts = stored;
            } else {
                customShortcuts = JSON.parse(JSON.stringify(DEFAULT_SHORTCUTS));
            }
        } catch {
            customShortcuts = JSON.parse(JSON.stringify(DEFAULT_SHORTCUTS));
        }
        for (const key in DEFAULT_SHORTCUTS) {
            if (!customShortcuts[key]) customShortcuts[key] = { ...DEFAULT_SHORTCUTS[key] };
        }
    }

    function saveCustomShortcuts() {
        localStorage.setItem('customShortcuts', JSON.stringify(customShortcuts));
    }

    function renderShortcutsEditor() {
        const container = document.getElementById('shortcuts-editor');
        if (!container) return;
        container.innerHTML = '';

        const order = ['help', 'sidebar', 'save', 'sync', 'logout', 'prevSection', 'nextSection', 'prevTab', 'nextTab'];

        order.forEach(actionName => {
            const config = customShortcuts[actionName];
            if (!config) return;

            const conflictAction = findConflict(actionName, config.keys);
            const row = document.createElement('div');
            row.className = 'shortcut-row' + (conflictAction ? ' conflict' : '');

            const labelText = currentLang === 'ar' ? config.label_ar : config.label_en;
            const keysHTML = config.keys.map(k => `<span class="key-cap">${k}</span>`).join('');

            row.innerHTML = `
                <div class="shortcut-label">
                    <span class="shortcut-label-icon">${config.icon}</span>
                    <span>${labelText}</span>
                    ${conflictAction ? `<span class="shortcut-conflict-badge">⚠️</span>` : ''}
                </div>
                <div class="shortcut-keys" data-action="${actionName}" title="${t('shortcut_edit_hint')}">
                    ${keysHTML}
                </div>
                <div class="shortcut-row-actions">
                    <button class="shortcut-reset-single" data-action="${actionName}" title="${t('reset_shortcuts')}">↺</button>
                </div>
            `;
            container.appendChild(row);
        });

        container.querySelectorAll('.shortcut-keys').forEach(el => {
            el.addEventListener('click', () => openShortcutRecorder(el.dataset.action));
        });

        container.querySelectorAll('.shortcut-reset-single').forEach(btn => {
            btn.addEventListener('click', () => {
                customShortcuts[btn.dataset.action] = JSON.parse(JSON.stringify(DEFAULT_SHORTCUTS[btn.dataset.action]));
                saveCustomShortcuts();
                renderShortcutsEditor();
                showToast(t('shortcut_saved'), 'success');
            });
        });
    }

    function openShortcutRecorder(actionName) {
        const config = customShortcuts[actionName];
        if (!config) return;
        const labelText = currentLang === 'ar' ? config.label_ar : config.label_en;

        let recordedKeys = [];

        showModal({
            title: currentLang === 'ar' ? `تسجيل اختصار: ${labelText}` : `Record shortcut: ${labelText}`,
            message: `
                <div class="recording-indicator">${t('recording_shortcut')}</div>
                <div class="recorded-keys" id="recorder-display">
                    <span class="placeholder">${t('press_keys')}</span>
                </div>
                <p style="font-size:12px;color:var(--dark);text-align:center;">
                    ${t('shortcut_edit_hint')}
                </p>
            `,
            icon: '⌨️',
            showCancel: true,
            okText: t('ok'),
            cancelText: t('cancel'),
            onRender: (overlay, close) => {
                const display = overlay.querySelector('#recorder-display');

                const updateDisplay = () => {
                    if (recordedKeys.length === 0) {
                        display.innerHTML = `<span class="placeholder">${t('press_keys')}</span>`;
                    } else {
                        display.innerHTML = recordedKeys.map(k => `<kbd>${k}</kbd>`).join('');
                    }
                };

                overlay.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') {
                        e.stopPropagation();
                        e.preventDefault();
                        close(null);
                        return;
                    }

                    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
                        const preview = [];
                        if (e.ctrlKey) preview.push('Ctrl');
                        if (e.altKey) preview.push('Alt');
                        if (e.shiftKey) preview.push('Shift');
                        if (e.metaKey) preview.push('Meta');
                        if (preview.length > 0) {
                            recordedKeys = preview;
                            updateDisplay();
                        }
                        return;
                    }

                    e.preventDefault();
                    e.stopPropagation();

                    const keys = [];
                    if (e.ctrlKey) keys.push('Ctrl');
                    if (e.altKey) keys.push('Alt');
                    if (e.shiftKey) keys.push('Shift');
                    if (e.metaKey) keys.push('Meta');

                    let mainKey = e.key;
                    if (mainKey === ' ') mainKey = 'Space';
                    if (mainKey.length === 1) mainKey = mainKey.toUpperCase();
                    keys.push(mainKey);

                    recordedKeys = keys;
                    updateDisplay();
                });

                const okBtn = overlay.querySelector('.modal-ok');
                okBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (recordedKeys.length === 0) return;
                    const conflict = findConflict(actionName, recordedKeys);
                    if (conflict) {
                        const conflictLabel = currentLang === 'ar'
                            ? customShortcuts[conflict].label_ar
                            : customShortcuts[conflict].label_en;
                        showToast(`${t('shortcut_conflict')}: ${conflictLabel}`, 'error');
                        return;
                    }
                    customShortcuts[actionName].keys = [...recordedKeys];
                    saveCustomShortcuts();
                    renderShortcutsEditor();
                    showToast(t('shortcut_saved'), 'success');
                    close(true);
                });
            }
        });
    }

    function initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const tag = (e.target.tagName || '').toLowerCase();
            const isField = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;

            if (e.ctrlKey && !e.altKey && !e.shiftKey && e.key === '/') {
                e.preventDefault();
                showKeyboardShortcutsHelp();
                return;
            }

            if (isField) return;

            if (e.altKey && !e.ctrlKey && !e.shiftKey) {
                const num = parseInt(e.key, 10);
                if (!isNaN(num) && num >= 0 && num <= 9) {
                    e.preventDefault();
                    navigateToSectionByIndex(num);
                    return;
                }
            }

            if (e.altKey && e.shiftKey && !e.ctrlKey) {
                const num = parseInt(e.key, 10);
                if (!isNaN(num) && num >= 0 && num <= 9) {
                    e.preventDefault();
                    navigateSubTabByIndex(num);
                    return;
                }
            }

            for (const [actionName, config] of Object.entries(customShortcuts)) {
                if (keysMatchEvent(e, config.keys)) {
                    e.preventDefault();
                    runShortcutAction(actionName);
                    return;
                }
            }
        });

        const helpBtn = document.getElementById('keyboard-help-btn');
        if (helpBtn) helpBtn.addEventListener('click', showKeyboardShortcutsHelp);
    }

    function runShortcutAction(actionName) {
        switch (actionName) {
            case 'help': showKeyboardShortcutsHelp(); break;
            case 'sidebar': {
                const sb = document.getElementById('sidebar');
                if (sb.classList.contains('open')) closeSidebar();
                else openSidebar();
                break;
            }
            case 'save':
                manualSync().then(() => showToast(t('saved'), 'success'));
                break;
            case 'sync':
                manualSync();
                break;
            case 'logout':
                if (currentUser) logout();
                break;
            case 'prevSection': navigateSectionByOffset(-1); break;
            case 'nextSection': navigateSectionByOffset(1); break;
            case 'prevTab': navigateSubTabByOffset(-1); break;
            case 'nextTab': navigateSubTabByOffset(1); break;
        }
    }

    function getVisibleNavItems() {
        return Array.from(document.querySelectorAll('.nav-item[data-section]')).filter(item => {
            const group = item.closest('.nav-group');
            if (group && group.classList.contains('admin-only') && !isAdmin) return false;
            return true;
        });
    }

    function getSectionDisplayName(sectionName) {
        const item = document.querySelector(`.nav-item[data-section="${sectionName}"]`);
        if (!item) return sectionName;
        const textSpan = item.querySelector('span[data-i18n]');
        return textSpan ? textSpan.textContent : sectionName;
    }

    function getSectionIcon(sectionName) {
        const item = document.querySelector(`.nav-item[data-section="${sectionName}"]`);
        if (!item) return '📄';
        const iconSpan = item.querySelector('.nav-icon');
        return iconSpan ? iconSpan.textContent : '📄';
    }

    function navigateToSectionByIndex(num) {
        const visibleItems = getVisibleNavItems();
        const idx = (num === 0) ? 9 : num - 1;
        if (idx < 0 || idx >= visibleItems.length) return;
        const targetSection = visibleItems[idx].dataset.section;
        if (!targetSection) return;
        navigateTo(targetSection);
        showNavHud(getSectionIcon(targetSection), getSectionDisplayName(targetSection), `Alt + ${num}`);
    }

    function navigateSubTabByIndex(num) {
        const activeSection = document.querySelector('.app-section.active');
        if (!activeSection) return;
        const tabs = activeSection.querySelectorAll('.sub-tab');
        const idx = (num === 0) ? 9 : num - 1;
        if (idx < 0 || idx >= tabs.length) return;
        tabs[idx].click();
        const tabText = tabs[idx].querySelector('span[data-i18n]');
        showNavHud('📑', tabText ? tabText.textContent : '', `Alt + Shift + ${num}`);
    }

    function navigateSubTabByOffset(offset) {
        const activeSection = document.querySelector('.app-section.active');
        if (!activeSection) return;
        const tabs = Array.from(activeSection.querySelectorAll('.sub-tab'));
        if (tabs.length === 0) return;
        const currentIdx = tabs.findIndex(t => t.classList.contains('active'));
        const newIdx = (currentIdx + offset + tabs.length) % tabs.length;
        tabs[newIdx].click();
        const tabText = tabs[newIdx].querySelector('span[data-i18n]');
        showNavHud('📑', tabText ? tabText.textContent : '', offset > 0 ? 'Alt + →' : 'Alt + ←');
    }

    function navigateSectionByOffset(offset) {
        const visibleItems = getVisibleNavItems();
        if (visibleItems.length === 0) return;
        const currentIdx = visibleItems.findIndex(i => i.dataset.section === currentSection);
        const newIdx = (currentIdx + offset + visibleItems.length) % visibleItems.length;
        const target = visibleItems[newIdx].dataset.section;
        navigateTo(target);
        showNavHud(getSectionIcon(target), getSectionDisplayName(target), offset > 0 ? 'Alt + ↓' : 'Alt + ↑');
    }

    function showKeyboardShortcutsHelp() {
        const isAr = currentLang === 'ar';
        const rows = [];

        const visibleItems = getVisibleNavItems();
        visibleItems.slice(0, 10).forEach((item, i) => {
            const name = item.querySelector('span[data-i18n]')?.textContent || item.dataset.section;
            rows.push([`<kbd>Alt</kbd> + <kbd>${i + 1}</kbd>`, name]);
        });

        Object.values(customShortcuts).forEach(config => {
            const labelText = isAr ? config.label_ar : config.label_en;
            const keysHTML = config.keys.map(k => `<kbd>${k}</kbd>`).join(' + ');
            rows.push([keysHTML, labelText]);
        });

        rows.push([`<kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>1</kbd>..<kbd>9</kbd>`, isAr ? 'التبويبات الفرعية' : 'Sub-tabs']);
        rows.push([`<kbd>Esc</kbd>`, isAr ? 'إغلاق القوائم والنوافذ' : 'Close menus and dialogs']);

        const tableHTML = `
            <table class="shortcuts-table">
                <thead><tr>
                    <th>${t('shortcut_col')}</th>
                    <th>${t('action_col')}</th>
                </tr></thead>
                <tbody>
                    ${rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}
                </tbody>
            </table>
            <div class="shortcut-hint">
                <span>💡</span>
                <span>${isAr
                    ? 'يمكنك تخصيص الاختصارات من الإعدادات → تخصيص اختصارات لوحة المفاتيح.'
                    : 'Customize shortcuts from Settings → Customize Keyboard Shortcuts.'}</span>
            </div>
        `;

        showModal({
            title: t('keyboard_shortcuts'),
            message: tableHTML,
            icon: '',
            okText: t('ok')
        });
    }

    // ============================================================
    //                المزامنة مع الخادم
    // ============================================================

    function rowToUser(u) {
        return {
            username: u.username,
            name: u.name,
            birthdate: u.birthdate,
            password: u.password,
            whatsapp: u.whatsapp || '',
            role: u.role || 'user'
        };
    }

    async function loadAllDataFromServer(showLoader = false) {
        if (showLoader) showConnectionStatus('syncing', t('sync_started'));
        try {
            const all = await api.getAllData();

            // Users → Object
            users = {};
            (all.users || []).forEach(u => {
                if (!u.username) return;
                users[u.username] = rowToUser(u);
            });

            // ✅ إنشاء admin تلقائياً عند أول تشغيل
            if (Object.keys(users).length === 0) {
                try {
                    const adminUser = {
                        username: ADMIN_USERNAME,
                        name: ADMIN_USERNAME,
                        birthdate: '1990-01-01',
                        password: ADMIN_PASSWORD,
                        whatsapp: '',
                        role: 'admin'
                    };
                    await api.addUser(adminUser);
                    users[ADMIN_USERNAME] = rowToUser(adminUser);
                    console.log('✅ تم إنشاء حساب المشرف الافتراضي تلقائياً');
                } catch (err) {
                    console.warn('تعذّر إنشاء المشرف تلقائياً:', err);
                }
            }

            vacations   = (all.vacations   || []).map(v => ({ ...v, id: String(v.id) }));
            requests    = (all.requests    || []).map(r => {
                const dates = typeof r.dates === 'string'
                    ? r.dates.split('|').filter(Boolean)
                    : (Array.isArray(r.dates) ? r.dates : []);
                return { ...r, id: String(r.id), dates, status: r.status || 'pending' };
            });
            permissions = (all.permissions || []).map(p => ({ ...p, id: String(p.id) }));
            holidays    = (all.holidays    || []).map(h => ({ ...h, id: String(h.id) }));
            auditLog    = (all.auditLog    || []).map(a => ({ ...a, id: String(a.id) }));

            if (holidays.length === 0) holidays = JSON.parse(JSON.stringify(DEFAULT_HOLIDAYS));

            connectionOnline = true;
            lastSyncTime = Date.now();
            if (showLoader) showConnectionStatus('online', t('sync_done'));
            return true;
        } catch (err) {
            console.error('Load failed:', err);
            connectionOnline = false;
            if (showLoader) showConnectionStatus('offline', t('sync_failed') + ': ' + err.message);
            return false;
        }
    }

    async function manualSync() {
        if (isSyncing) return;
        isSyncing = true;
        try {
            await loadAllDataFromServer(true);
            await refreshUI();
            reinitAllFlatpickr();
        } catch (err) {
            console.error(err);
            showToast(t('sync_failed'), 'error');
        } finally {
            isSyncing = false;
        }
    }

    function startAutoSync() {
        if (!autoSyncEnabled) return;
        stopAutoSync();
        syncInterval = setInterval(async () => {
            if (isSyncing || !currentUser || !navigator.onLine) return;
            await pollForUpdates();
        }, SYNC_INTERVAL_MS);
    }

    function stopAutoSync() {
        if (syncInterval) {
            clearInterval(syncInterval);
            syncInterval = null;
        }
    }

    async function pollForUpdates() {
        try {
            const all = await api.getAllData();
            const serverRequests = (all.requests || []).map(r => ({
                ...r,
                id: String(r.id),
                dates: typeof r.dates === 'string'
                    ? r.dates.split('|').filter(Boolean)
                    : (Array.isArray(r.dates) ? r.dates : [])
            }));
            const serverVacations = (all.vacations || []).map(v => ({ ...v, id: String(v.id) }));
            const serverPermissions = (all.permissions || []).map(p => ({ ...p, id: String(p.id) }));

            const sameLength = serverRequests.length === requests.length &&
                              serverVacations.length === vacations.length &&
                              serverPermissions.length === permissions.length;
            const sameContent = JSON.stringify(serverRequests.map(r => r.id + r.status)) ===
                               JSON.stringify(requests.map(r => r.id + r.status));

            if (!sameLength || !sameContent) {
                const newPending = serverRequests.filter(r => r.status === 'pending').length;
                const oldPending = requests.filter(r => r.status === 'pending').length;

                requests = serverRequests;
                vacations = serverVacations;
                permissions = serverPermissions;

                users = {};
                (all.users || []).forEach(u => {
                    if (!u.username) return;
                    users[u.username] = rowToUser(u);
                });
                holidays = (all.holidays || []).map(h => ({ ...h, id: String(h.id) }));
                auditLog = (all.auditLog || []).map(a => ({ ...a, id: String(a.id) }));

                lastSyncTime = Date.now();
                connectionOnline = true;

                await refreshUI();

                if (isAdmin && newPending > oldPending) {
                    showToast(t('new_request_notification'), 'info');
                }
            }
        } catch (err) {
            connectionOnline = false;
        }
    }

    function initNetworkMonitor() {
        window.addEventListener('online', () => {
            connectionOnline = true;
            showConnectionStatus('online', t('online'));
            if (currentUser) manualSync();
        });
        window.addEventListener('offline', () => {
            connectionOnline = false;
            showConnectionStatus('offline', t('offline'));
        });
    }

    // ============================================================
    //                    إدارة الجلسة
    // ============================================================

    function initSession() {
        sessionTimeoutEnabled = localStorage.getItem('sessionTimeoutEnabled') === '1';
        sessionDurationMinutes = parseInt(localStorage.getItem('sessionDuration') || '30', 10);
        sessionWarningMinutes = parseInt(localStorage.getItem('sessionWarning') || '2', 10);

        const toggle = document.getElementById('session-timeout-toggle');
        const durInput = document.getElementById('session-duration');
        const warnInput = document.getElementById('session-warning');
        if (toggle) toggle.checked = sessionTimeoutEnabled;
        if (durInput) durInput.value = sessionDurationMinutes;
        if (warnInput) warnInput.value = sessionWarningMinutes;

        if (toggle) toggle.addEventListener('change', (e) => {
            sessionTimeoutEnabled = e.target.checked;
            localStorage.setItem('sessionTimeoutEnabled', sessionTimeoutEnabled ? '1' : '0');
            logAction('change_setting', `انتهاء الجلسة: ${sessionTimeoutEnabled}`);
            if (sessionTimeoutEnabled && currentUser) startSessionMonitoring();
            else stopSessionMonitoring();
        });

        if (durInput) durInput.addEventListener('change', (e) => {
            const v = Math.max(1, Math.min(480, parseInt(e.target.value, 10) || 30));
            sessionDurationMinutes = v;
            durInput.value = v;
            localStorage.setItem('sessionDuration', String(v));
            if (sessionTimeoutEnabled && currentUser) resetSessionTimer();
        });

        if (warnInput) warnInput.addEventListener('change', (e) => {
            const v = Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 2));
            sessionWarningMinutes = v;
            warnInput.value = v;
            localStorage.setItem('sessionWarning', String(v));
        });

        ACTIVITY_EVENTS.forEach(ev => {
            document.addEventListener(ev, throttledActivity, { passive: true });
        });

        if (sessionTimeoutEnabled && currentUser) startSessionMonitoring();
    }

    function throttledActivity() {
        const now = Date.now();
        if (now - lastActivityThrottle < 5000) return;
        lastActivityThrottle = now;
        lastActivityTime = now;
        sessionWarningShown = false;
        if (sessionTimeoutEnabled && currentUser) resetSessionTimer();
    }

    function startSessionMonitoring() {
        stopSessionMonitoring();
        lastActivityTime = Date.now();
        sessionWarningShown = false;
        resetSessionTimer();
        updateSessionCountdown();
    }

    function stopSessionMonitoring() {
        if (sessionTimer) clearTimeout(sessionTimer);
        if (sessionWarningTimer) clearTimeout(sessionWarningTimer);
        if (sessionCountdownInterval) clearInterval(sessionCountdownInterval);
        sessionTimer = null;
        sessionWarningTimer = null;
        sessionCountdownInterval = null;
        const cd = document.getElementById('session-countdown');
        if (cd) cd.classList.remove('show');
    }

    function resetSessionTimer() {
        if (!sessionTimeoutEnabled || !currentUser) return;
        if (sessionTimer) clearTimeout(sessionTimer);
        if (sessionWarningTimer) clearTimeout(sessionWarningTimer);

        const durationMs = sessionDurationMinutes * 60 * 1000;
        const warningMs = Math.max(0, durationMs - sessionWarningMinutes * 60 * 1000);

        sessionWarningTimer = setTimeout(() => {
            if (!sessionWarningShown && sessionTimeoutEnabled && currentUser) {
                sessionWarningShown = true;
                showSessionWarning();
            }
        }, warningMs);

        sessionTimer = setTimeout(() => {
            if (sessionTimeoutEnabled && currentUser) endSession('timeout');
        }, durationMs);
    }

    function updateSessionCountdown() {
        if (sessionCountdownInterval) clearInterval(sessionCountdownInterval);
        if (!sessionTimeoutEnabled || !currentUser) return;

        const cd = document.getElementById('session-countdown');
        if (!cd) return;
        cd.classList.add('show');

        const tick = () => {
            const elapsed = Date.now() - lastActivityTime;
            const remaining = sessionDurationMinutes * 60 * 1000 - elapsed;
            if (remaining <= 0) {
                cd.querySelector('.session-countdown-text').textContent = '00:00';
                return;
            }
            const min = Math.floor(remaining / 60000);
            const sec = Math.floor((remaining % 60000) / 1000);
            const text = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
            cd.querySelector('.session-countdown-text').textContent = text;

            cd.classList.remove('warning', 'critical');
            if (remaining <= sessionWarningMinutes * 60 * 1000) cd.classList.add('critical');
            else if (remaining <= sessionWarningMinutes * 60 * 1000 * 2) cd.classList.add('warning');
        };
        tick();
        sessionCountdownInterval = setInterval(tick, 1000);
    }

    function showSessionWarning() {
        if (!sessionTimeoutEnabled || !currentUser) return;
        const remainingSec = sessionWarningMinutes * 60;

        showModal({
            title: t('session_warning_title'),
            message: `
                <div class="session-warning-box">
                    <p>${t('session_warning_msg')}</p>
                    <div class="session-timer-display" id="session-warn-timer">${remainingSec}</div>
                    <p>${t('seconds')}</p>
                </div>
            `,
            icon: '⏱️',
            showCancel: false,
            okText: t('extend_session'),
            okClass: 'btn-success',
            onRender: (overlay, close) => {
                let count = remainingSec;
                const display = overlay.querySelector('#session-warn-timer');
                const interval = setInterval(() => {
                    count--;
                    if (display) display.textContent = count;
                    if (count <= 0) clearInterval(interval);
                }, 1000);
                overlay.querySelector('.modal-ok').addEventListener('click', () => clearInterval(interval));
            }
        }).then((result) => {
            if (result === true) {
                lastActivityTime = Date.now();
                sessionWarningShown = false;
                resetSessionTimer();
                showToast(t('session_extended'), 'success');
            }
        });
    }

    function endSession(reason = 'timeout') {
        logAction('logout', `انتهاء الجلسة (${reason})`);
        showToast(t('session_expired'), 'warning', 6000);

        currentUser = null;
        isAdmin = false;
        sessionStorage.removeItem('loggedUser');
        document.body.classList.remove('is-admin');
        clearNavState();
        stopSessionMonitoring();
        stopAutoSync();
        loginSection.style.display = 'block';
        appContent.style.display = 'none';
        document.querySelectorAll('#app-content .app-section').forEach(s => s.classList.remove('active'));
    }

    // ============================================================
    //                النسخ الاحتياطي التلقائي
    // ============================================================

    function initAutoBackup() {
        autoBackupEnabled = localStorage.getItem('autoBackupEnabled') === '1';
        backupFrequency = localStorage.getItem('backupFrequency') || 'daily';

        const toggle = document.getElementById('auto-backup-toggle');
        const freq = document.getElementById('backup-frequency');
        if (toggle) toggle.checked = autoBackupEnabled;
        if (freq) freq.value = backupFrequency;

        if (toggle) toggle.addEventListener('change', (e) => {
            autoBackupEnabled = e.target.checked;
            localStorage.setItem('autoBackupEnabled', autoBackupEnabled ? '1' : '0');
            logAction('change_setting', `النسخ التلقائي: ${autoBackupEnabled}`);
            if (autoBackupEnabled) {
                scheduleAutoBackup();
                showToast(t('auto_backup_enabled'), 'success');
            } else {
                stopAutoBackup();
                showToast(t('auto_backup_disabled'), 'info');
            }
            updateBackupStatus();
        });

        if (freq) freq.addEventListener('change', (e) => {
            backupFrequency = e.target.value;
            localStorage.setItem('backupFrequency', backupFrequency);
            if (autoBackupEnabled) scheduleAutoBackup();
            updateBackupStatus();
        });

        const runNow = document.getElementById('run-backup-now');
        if (runNow) runNow.addEventListener('click', async () => {
            await createBackup('manual');
            showToast(t('backup_created'), 'success');
        });

        const viewBtn = document.getElementById('view-backups-btn');
        if (viewBtn) viewBtn.addEventListener('click', showBackupsList);

        const dl = document.getElementById('download-latest-backup');
        if (dl) dl.addEventListener('click', downloadLatestBackup);

        if (autoBackupEnabled && currentUser) {
            scheduleAutoBackup();
            checkAndRunDueBackup();
        }
        updateBackupStatus();
    }

    function getBackupIntervalMs() {
        switch (backupFrequency) {
            case 'hourly': return 60 * 60 * 1000;
            case 'weekly': return 7 * 24 * 60 * 60 * 1000;
            case 'daily':
            default:       return 24 * 60 * 60 * 1000;
        }
    }

    function scheduleAutoBackup() {
        stopAutoBackup();
        if (!autoBackupEnabled) return;
        autoBackupTimer = setInterval(async () => {
            if (autoBackupEnabled) await createBackup('auto');
        }, getBackupIntervalMs());
    }

    function stopAutoBackup() {
        if (autoBackupTimer) {
            clearInterval(autoBackupTimer);
            autoBackupTimer = null;
        }
    }

    async function checkAndRunDueBackup() {
        if (!autoBackupEnabled) return;
        const lastRun = parseInt(localStorage.getItem('lastAutoBackupTime') || '0', 10);
        const now = Date.now();
        if (now - lastRun >= getBackupIntervalMs()) {
            setTimeout(() => createBackup('auto'), 5000);
        }
    }

    async function createBackup(type = 'manual') {
        try {
            const backup = {
                id: generateId(),
                type,
                timestamp: new Date().toISOString(),
                createdBy: currentUser || 'system',
                version: 'v7',
                data: {
                    users: JSON.parse(JSON.stringify(users)),
                    vacations: JSON.parse(JSON.stringify(vacations)),
                    requests: JSON.parse(JSON.stringify(requests)),
                    permissions: JSON.parse(JSON.stringify(permissions)),
                    holidays: JSON.parse(JSON.stringify(holidays)),
                    auditLog: auditLog.slice(-200)
                }
            };

            const backups = getBackups();
            backups.push(backup);
            const sorted = backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
            const trimmed = sorted.slice(0, MAX_AUTO_BACKUPS);

            localStorage.setItem('backups', JSON.stringify(trimmed));

            if (type === 'auto') {
                localStorage.setItem('lastAutoBackupTime', String(Date.now()));
            }

            logAction('export_data', `نسخة احتياطية ${type === 'auto' ? 'تلقائية' : 'يدوية'}`);
            updateBackupStatus();
            return backup;
        } catch (err) {
            console.error('Backup failed:', err);
            showToast(t('backup_failed'), 'error');
            return null;
        }
    }

    function getBackups() {
        try { return JSON.parse(localStorage.getItem('backups')) || []; }
        catch { return []; }
    }

    function updateBackupStatus() {
        const info = document.getElementById('backup-status-info');
        if (!info) return;
        const backups = getBackups();
        const autoBackups = backups.filter(b => b.type === 'auto');
        const lastAuto = autoBackups.length > 0
            ? autoBackups.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
            : null;

        const freqLabel = {
            hourly: t('freq_hourly'),
            daily:  t('freq_daily'),
            weekly: t('freq_weekly')
        }[backupFrequency];

        const lastTime = lastAuto
            ? new Date(lastAuto.timestamp).toLocaleString(currentLang === 'ar' ? 'ar-EG' : 'en-US')
            : t('backup_none');

        info.innerHTML = `
            <div class="backup-row"><strong>${t('backup_status')}:</strong>
                <span>${autoBackupEnabled ? `${t('backup_enabled')} — ${freqLabel}` : t('backup_disabled_state')}</span></div>
            <div class="backup-row"><strong>${t('backup_last_auto')}:</strong><span>${lastTime}</span></div>
            <div class="backup-row"><strong>${t('backup_saved_count')}:</strong>
                <span class="backup-count">${backups.length}</span></div>
        `;
    }

    async function showBackupsList() {
        const backups = getBackups();
        if (backups.length === 0) return await showAlert(t('no_backups'), t('backups_title'), '📭');

        const sorted = backups.slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp));

        const listHTML = `
            <div class="backup-list">
                ${sorted.map(b => {
                    const isAuto = b.type === 'auto';
                    const dateStr = new Date(b.timestamp).toLocaleString(currentLang === 'ar' ? 'ar-EG' : 'en-US');
                    const stats = {
                        users: Object.keys(b.data.users || {}).length,
                        vacations: (b.data.vacations || []).length
                    };
                    return `
                        <div class="backup-item">
                            <div class="backup-item-info">
                                <div class="backup-item-title">
                                    ${dateStr}
                                    <span class="backup-type-badge ${isAuto ? 'backup-type-auto' : 'backup-type-manual'}">
                                        ${isAuto ? t('backup_auto_label') : t('backup_manual_label')}
                                    </span>
                                </div>
                                <div class="backup-item-subtitle">
                                    ${t('users_label')}: ${stats.users} · ${t('leaves_label')}: ${stats.vacations}
                                </div>
                            </div>
                            <div class="backup-item-actions">
                                <button class="btn btn-primary btn-sm" data-restore="${b.id}">↺</button>
                                <button class="btn btn-secondary btn-sm" data-download="${b.id}">⬇️</button>
                                <button class="btn btn-danger btn-sm" data-delete="${b.id}">🗑️</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        await showModal({
            title: t('backups_title'),
            message: listHTML,
            icon: '',
            okText: t('ok'),
            onRender: (overlay, close) => {
                overlay.querySelectorAll('[data-restore]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const id = btn.dataset.restore;
                        const backup = backups.find(b => b.id === id);
                        if (!backup) return;
                        const ok = await showConfirm(t('restore_confirm'), t('confirm'), '⚠️');
                        if (!ok) return;

                        pushState();
                        users = backup.data.users || {};
                        vacations = backup.data.vacations || [];
                        requests = backup.data.requests || [];
                        permissions = backup.data.permissions || [];
                        holidays = backup.data.holidays || [];
                        auditLog = backup.data.auditLog || [];

                        try {
                            await api.replaceAllData({
                                users: Object.values(users),
                                vacations, requests, permissions, holidays, auditLog
                            });
                            showToast(t('restored_success'), 'success');
                            close(true);
                            refreshUI();
                        } catch (err) {
                            showToast(t('backup_failed'), 'error');
                        }
                    });
                });

                overlay.querySelectorAll('[data-download]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const b = backups.find(x => x.id === btn.dataset.download);
                        if (b) downloadBackupAsFile(b);
                    });
                });

                overlay.querySelectorAll('[data-delete]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const id = btn.dataset.delete;
                        const ok = await showConfirm(t('backup_deleted'), t('delete'), '⚠️');
                        if (!ok) return;
                        const filtered = backups.filter(b => b.id !== id);
                        localStorage.setItem('backups', JSON.stringify(filtered));
                        updateBackupStatus();
                        close(true);
                        showToast(t('deleted'), 'success');
                    });
                });
            }
        });
    }

    function downloadBackupAsFile(backup) {
        const content = { ...backup.data, _meta: { timestamp: backup.timestamp, type: backup.type, version: backup.version } };
        const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        const date = new Date(backup.timestamp);
        const stamp = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}_${String(date.getHours()).padStart(2,'0')}${String(date.getMinutes()).padStart(2,'0')}`;
        a.download = `backup_${backup.type}_${stamp}.json`;
        a.click();
    }

    async function downloadLatestBackup() {
        const backups = getBackups();
        if (backups.length === 0) return await showAlert(t('no_backups'), t('alert'), '📭');
        const latest = backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
        downloadBackupAsFile(latest);
        showToast(t('latest_downloaded'), 'success');
    }

    // ============================================================
    //                إعدادات الخادم
    // ============================================================

    function initApiSettings() {
        const urlInput = document.getElementById('api-url-input');
        const tokenInput = document.getElementById('api-token-input');
        const config = api.getConfig();
        if (urlInput) urlInput.value = config.url;
        if (tokenInput) tokenInput.value = config.token;

        const saveBtn = document.getElementById('save-api-settings');
        if (saveBtn) saveBtn.addEventListener('click', async () => {
            const url = urlInput.value.trim();
            const token = tokenInput.value.trim();
            if (!url) return showAlert(t('api_url_required'), t('alert'), '⚠️');
            if (!token) return showAlert(t('token_required'), t('alert'), '⚠️');
            api.setConfig(url, token);
            showToast(t('api_saved'), 'success');
            updateApiStatusDisplay();
        });

        const testBtn = document.getElementById('test-api-connection');
        if (testBtn) testBtn.addEventListener('click', async () => {
            await testApiConnection();
        });

        updateApiStatusDisplay();
    }

    async function testApiConnection() {
        const info = document.getElementById('api-status-info');
        if (info) info.innerHTML = `<div class="backup-row"><span>${t('connection_testing')}</span></div>`;
        try {
            await api.ping();
            if (info) info.innerHTML = `<div class="backup-row"><span style="color:var(--success);font-weight:bold;">${t('connection_ok')}</span></div>`;
            showToast(t('connection_ok'), 'success');
        } catch (err) {
            if (info) info.innerHTML = `<div class="backup-row"><span style="color:var(--danger);font-weight:bold;">${t('connection_fail')}: ${err.message}</span></div>`;
            showToast(t('connection_fail'), 'error');
        }
    }

    function updateApiStatusDisplay() {
        const info = document.getElementById('api-status-info');
        if (!info) return;
        const config = api.getConfig();
        info.innerHTML = `
            <div class="backup-row"><strong>URL:</strong>
                <span style="direction:ltr;font-size:11px;word-break:break-all;">${config.url || '—'}</span></div>
            <div class="backup-row"><strong>Token:</strong>
                <span style="direction:ltr;font-size:11px;">${config.token ? '••••••••' : '—'}</span></div>
        `;
    }

    // ============================================================
    //                واجهة المستخدم
    // ============================================================

    function addDateField(value = '') {
        const container = document.getElementById('vacation-dates-container');
        const div = document.createElement('div');
        div.className = 'date-range';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'vacation-date datepicker';
        input.value = value;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-danger btn-sm';
        btn.textContent = '×';
        btn.addEventListener('click', () => div.remove());
        div.appendChild(input);
        div.appendChild(btn);
        container.appendChild(div);
        initFlatpickr(input);
    }

    async function refreshUI() {
        if (!currentUser) return;
        const u = users[currentUser];
        if (!u) return;

        const age = calculateAge(u.birthdate);
        const alloc = getAllocatedDays(u.birthdate);

        const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setText('display-username', u.name);
        setText('display-age', age);
        setText('allocated-regular', alloc);

        const filtered = filterVacationsByYear(selectedFiscalYear);
        const userVac = filtered.filter(v => v.username === u.name);
        const usedRegular = userVac.filter(v => v.type === 'اعتيادية').length;
        const usedCasual = userVac.filter(v => v.type === 'عارضة').length;
        const usedSick = userVac.filter(v => v.type === 'مرضية').length;

        setText('remaining-regular', Math.max(alloc - usedRegular, 0));
        setText('remaining-casual', Math.max(CASUAL_DAYS - usedCasual, 0));
        setText('remaining-sick', Math.max(SICK_DAYS - usedSick, 0));

        const remainingReg = alloc - usedRegular;
        if (remainingReg <= 5 && remainingReg > 0) {
            showNotification(t('low_balance', { days: remainingReg }));
        }

        const editBtn = document.getElementById('edit-user-btn');
        const deleteBtn = document.getElementById('delete-user-btn');
        if (editBtn) editBtn.disabled = isAdmin;
        if (deleteBtn) deleteBtn.disabled = isAdmin;

        populateFiscalYearFilter(document.getElementById('fiscal-year-filter'), selectedFiscalYear);
        populateFiscalYearFilter(document.getElementById('search-fiscal-year'), searchFiscalYear);

        const pendingCount = requests.filter(r => r.status === 'pending').length;
        const badge = document.getElementById('pending-badge');
        if (badge) {
            badge.textContent = pendingCount;
            badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
        }
        const tabBadge = document.getElementById('pending-tab-badge');
        if (tabBadge) {
            tabBadge.textContent = pendingCount;
            tabBadge.classList.toggle('show', pendingCount > 0);
        }

        document.body.classList.toggle('is-admin', isAdmin);

        updateVacationTable();
        updateUserList();
        updateCharts();
        renderMyRequests();
        renderPendingRequests();
        renderPermissions();
        renderHolidays();
        renderAuditLog();

        if (isAdmin) renderAdminSummary();
    }

    function updateVacationTable() {
        const tbody = document.querySelector('#vacation-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!currentUser) return;
        const filtered = filterVacationsByYear(selectedFiscalYear).filter(v => v.username === currentUser);
        const toShow = filtered.slice(0, vacationDisplayLimit);

        toShow.forEach(vac => {
            const row = tbody.insertRow();
            const dateCell = hijriEnabled
                ? `${vac.date}<br><small style="color:var(--dark);">${toHijri(vac.date)}</small>`
                : vac.date;
            row.innerHTML = `
                <td>${dateCell}</td><td>${vac.type}</td>
                <td><button class="btn btn-danger btn-sm delete-vacation"
                            data-id="${vac.id}" data-date="${vac.date}" data-type="${vac.type}">X</button></td>`;
        });

        const loadMoreBtn = document.getElementById('load-more-vacations');
        const remaining = filtered.length - vacationDisplayLimit;
        if (loadMoreBtn) {
            if (remaining > 0) {
                loadMoreBtn.style.display = 'inline-block';
                loadMoreBtn.textContent = currentLang === 'ar'
                    ? `تحميل المزيد (${remaining} متبقي)` : `Load More (${remaining} left)`;
            } else loadMoreBtn.style.display = 'none';
        }

        document.querySelectorAll('.delete-vacation').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const date = btn.dataset.date, type = btn.dataset.type;
                const ok = await showConfirm(t('confirm_delete_vacation', { type, date }), t('delete'));
                if (!ok) return;

                try {
                    if (id) await api.deleteVacation(id);
                    vacations = vacations.filter(v => v.id !== id);
                    logAction('delete_vacation', `${type} - ${date}`);
                    showToast(t('saved'), 'success');
                    refreshUI();
                } catch (err) {
                    showToast(t('sync_failed'), 'error');
                }
            });
        });
    }

    function updateUserList() {
        if (!isAdmin) return;
        const list = document.getElementById('user-names');
        if (!list) return;
        list.innerHTML = '';
        for (const username in users) {
            if (username === ADMIN_USERNAME) continue;
            const li = document.createElement('li');
            li.className = 'user-item';
            if (username === currentUser) li.classList.add('active');

            const nameSpan = document.createElement('span');
            nameSpan.textContent = username;
            nameSpan.style.cursor = 'pointer';
            nameSpan.addEventListener('click', () => { currentUser = username; refreshUI(); });
            li.appendChild(nameSpan);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'user-item-actions';

            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-warning btn-sm';
            editBtn.textContent = currentLang === 'ar' ? 'تعديل' : 'Edit';
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const u = users[username];
                document.getElementById('username').value = u.name;
                document.getElementById('birthdate').value = u.birthdate;
                document.getElementById('user-password').value = u.password;
                document.getElementById('user-whatsapp').value = u.whatsapp || '';
                document.getElementById('edit-username').value = username;
                document.getElementById('user-submit-btn').textContent = t('update');
                document.getElementById('cancel-edit').style.display = 'inline-block';
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-danger btn-sm';
            deleteBtn.textContent = t('delete');
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const ok = await showConfirm(t('confirm_delete_user', { name: username }), t('delete'));
                if (!ok) return;

                try {
                    await api.deleteUser(username);
                    delete users[username];
                    vacations = vacations.filter(v => v.username !== username);
                    requests = requests.filter(r => r.username !== username);
                    permissions = permissions.filter(p => p.username !== username);
                    logAction('delete_user', username);
                    if (currentUser === username) currentUser = Object.keys(users)[0] || null;
                    showToast(t('saved'), 'success');
                    refreshUI();
                } catch (err) {
                    showToast(t('sync_failed'), 'error');
                }
            });

            actionsDiv.appendChild(editBtn);
            actionsDiv.appendChild(deleteBtn);
            li.appendChild(actionsDiv);
            list.appendChild(li);
        }
    }

    function renderMyRequests() {
        const container = document.getElementById('my-requests-container');
        if (!container || !currentUser) return;
        const myReqs = requests.filter(r => r.username === currentUser)
                               .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
        if (myReqs.length === 0) {
            container.innerHTML = `<p style="color:var(--dark);">${t('no_requests')}</p>`;
            return;
        }
        container.innerHTML = myReqs.map(r => `
            <div class="request-item">
                <div class="request-item-header">
                    <strong>${r.type}</strong>
                    <span class="status-badge status-${r.status}">${t(r.status)}</span>
                </div>
                <div class="request-item-dates">📅 ${r.dates.length} ${t('days_count')}: ${r.dates.join(' , ')}</div>
                <div style="font-size:12px; color:var(--dark);">
                    ${t('request_submitted_at')}: ${new Date(r.submittedAt).toLocaleString(currentLang === 'ar' ? 'ar-EG' : 'en-US')}
                </div>
                ${r.status === 'pending' ? `<div class="request-item-actions">
                    <button class="btn btn-danger btn-sm cancel-request" data-id="${r.id}">${t('cancel_request')}</button>
                </div>` : ''}
                ${r.reviewNote ? `<div class="request-note">${t('review_note')}: ${r.reviewNote}</div>` : ''}
            </div>`).join('');

        container.querySelectorAll('.cancel-request').forEach(btn => {
            btn.addEventListener('click', async () => {
                const ok = await showConfirm(t('confirm_cancel_request'), t('cancel_request'), '⚠️');
                if (!ok) return;
                try {
                    await api.deleteRequest(btn.dataset.id);
                    requests = requests.filter(r => r.id !== btn.dataset.id);
                    logAction('reject_request', `إلغاء ذاتي للطلب ${btn.dataset.id}`);
                    showToast(t('deleted'), 'success');
                    refreshUI();
                } catch (err) { showToast(t('sync_failed'), 'error'); }
            });
        });
    }

    function renderPendingRequests() {
        if (!isAdmin) return;
        const container = document.getElementById('pending-requests-container');
        if (!container) return;
        const pending = requests.filter(r => r.status === 'pending')
                                .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
        if (pending.length === 0) {
            container.innerHTML = `<p style="color:var(--dark);">${t('no_pending')}</p>`;
            return;
        }
        container.innerHTML = pending.map(r => `
            <div class="request-item">
                <div class="request-item-header">
                    <strong>👤 ${r.username} — ${r.type}</strong>
                    <span class="status-badge status-pending">${t('pending')}</span>
                </div>
                <div class="request-item-dates">📅 ${r.dates.length} ${t('days_count')}: ${r.dates.join(' , ')}</div>
                <div style="font-size:12px; color:var(--dark);">
                    ${t('request_submitted_at')}: ${new Date(r.submittedAt).toLocaleString(currentLang === 'ar' ? 'ar-EG' : 'en-US')}
                </div>
                <div class="request-item-actions">
                    <button class="btn btn-success btn-sm approve-req" data-id="${r.id}">${t('approve')}</button>
                    <button class="btn btn-danger btn-sm reject-req" data-id="${r.id}">${t('reject')}</button>
                </div>
            </div>`).join('');

        container.querySelectorAll('.approve-req').forEach(b => b.addEventListener('click', async () => {
            const req = requests.find(r => r.id === b.dataset.id);
            const note = await showPrompt(t('note_optional'), '', `${t('approve')} - ${req.username}`, '✅');
            if (note === null) return;
            await approveRequest(b.dataset.id, note);
        }));
        container.querySelectorAll('.reject-req').forEach(b => b.addEventListener('click', async () => {
            const note = await showPrompt(t('reject_reason'), '', t('reject'), '❌');
            if (note === null) return;
            await rejectRequest(b.dataset.id, note);
        }));
    }

    async function approveRequest(id, note = '') {
        const req = requests.find(r => r.id === id);
        if (!req || req.status !== 'pending') return;

        req.status = 'approved';
        req.reviewedAt = new Date().toISOString();
        req.reviewedBy = currentUser;
        req.reviewNote = note;

        try {
            await api.updateRequest(id, apiRequestToRow(req));

            for (const d of req.dates) {
                if (!vacations.some(v => v.username === req.username && v.date === d)) {
                    const v = { username: req.username, date: d, type: req.type };
                    const res = await api.addVacation(v);
                    vacations.push({ ...v, id: res.id });
                }
            }

            logAction('approve_request', `${req.username} - ${req.type} - ${req.dates.length} يوم`);

            const empPhone = (users[req.username] && users[req.username].whatsapp) || whatsappNumber;
            if (empPhone) await sendWhatsAppNotification(empPhone, buildApprovalMessage(req));

            showToast(t('request_approved'), 'success');
            refreshUI();
        } catch (err) {
            console.error(err);
            showToast(t('sync_failed'), 'error');
        }
    }

    async function rejectRequest(id, note = '') {
        const req = requests.find(r => r.id === id);
        if (!req || req.status !== 'pending') return;
        req.status = 'rejected';
        req.reviewedAt = new Date().toISOString();
        req.reviewedBy = currentUser;
        req.reviewNote = note;

        try {
            await api.updateRequest(id, apiRequestToRow(req));
            logAction('reject_request', `${req.username} - ${req.type} - ${req.dates.length} يوم`);

            const empPhone = (users[req.username] && users[req.username].whatsapp) || whatsappNumber;
            if (empPhone) await sendWhatsAppNotification(empPhone, buildRejectionMessage(req));

            showToast(t('request_rejected'), 'warning');
            refreshUI();
        } catch (err) {
            console.error(err);
            showToast(t('sync_failed'), 'error');
        }
    }

    function renderPermissions() {
        const tbody = document.querySelector('#permission-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        const myPerms = permissions.filter(p => p.username === currentUser)
                                   .sort((a, b) => b.date.localeCompare(a.date));
        myPerms.forEach(p => {
            const row = tbody.insertRow();
            const dateCell = hijriEnabled
                ? `${p.date}<br><small style="color:var(--dark);">${toHijri(p.date)}</small>`
                : p.date;
            row.innerHTML = `
                <td>${dateCell}</td>
                <td>${currentLang === 'ar' ? p.session : (p.session === 'صباحي' ? t('morning') : t('evening'))}</td>
                <td>${t('two_hours')}</td>
                <td><button class="btn btn-danger btn-sm del-perm" data-id="${p.id}">X</button></td>`;
        });
        tbody.parentElement.parentElement.querySelectorAll('.del-perm').forEach(btn => {
            btn.addEventListener('click', async () => {
                const ok = await showConfirm(t('confirm_delete_permission'), t('delete'), '⚠️');
                if (!ok) return;
                try {
                    await api.deletePermission(btn.dataset.id);
                    permissions = permissions.filter(p => p.id !== btn.dataset.id);
                    logAction('delete_permission', btn.dataset.id);
                    showToast(t('deleted'), 'success');
                    refreshUI();
                } catch (err) { showToast(t('sync_failed'), 'error'); }
            });
        });
    }

    async function submitPermission(session, dateStr) {
        if (!currentUser) return await showAlert(t('error'), t('error'), '❌');
        if (!isWorkingDay(dateStr)) return await showAlert(t('not_working_day'), t('alert'), '⚠️');
        const weekKey = getWeekKey(dateStr);
        const exists = permissions.some(p => p.username === currentUser && p.weekKey === weekKey);
        if (exists) return await showAlert(t('permission_weekly_limit'), t('permissions'), '⏰');

        const perm = {
            username: currentUser,
            date: dateStr,
            session,
            weekKey,
            createdAt: new Date().toISOString()
        };

        try {
            const res = await api.addPermission(perm);
            permissions.push({ ...perm, id: res.id });
            logAction('add_permission', `${session} - ${dateStr}`);
            showToast(t('permission_added'), 'success');
            refreshUI();
        } catch (err) {
            showToast(t('sync_failed'), 'error');
        }
    }

    function renderHolidays() {
        const list = document.getElementById('holidays-list');
        if (!list) return;
        list.innerHTML = '';
        const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));
        if (sorted.length === 0) {
            list.innerHTML = `<li style="justify-content:center; color:var(--dark);">${t('no_holidays')}</li>`;
            return;
        }
        sorted.forEach(h => {
            const li = document.createElement('li');
            li.innerHTML = `<span>📅 <strong>${h.date}</strong> — ${h.name}</span>
                            <button class="btn btn-danger btn-sm" data-id="${h.id}" data-date="${h.date}">${t('delete')}</button>`;
            list.appendChild(li);
        });
        list.querySelectorAll('button[data-date]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const ok = await showConfirm(t('confirm_delete_holiday'), t('delete'), '⚠️');
                if (!ok) return;
                try {
                    if (btn.dataset.id) await api.deleteHoliday(btn.dataset.id);
                    holidays = holidays.filter(h => h.date !== btn.dataset.date);
                    logAction('delete_holiday', btn.dataset.date);
                    reinitAllFlatpickr();
                    showToast(t('deleted'), 'success');
                    refreshUI();
                } catch (err) { showToast(t('sync_failed'), 'error'); }
            });
        });
    }

    async function addHoliday(name, dateStr) {
        if (holidays.some(h => h.date === dateStr))
            return await showAlert(t('holiday_exists'), t('alert'), '⚠️');
        const holiday = { date: dateStr, name };
        try {
            const res = await api.addHoliday(holiday);
            holidays.push({ ...holiday, id: res.id });
            logAction('add_holiday', `${name} - ${dateStr}`);
            reinitAllFlatpickr();
            showToast(t('holiday_added'), 'success');
            refreshUI();
        } catch (err) { showToast(t('sync_failed'), 'error'); }
    }

    function renderAuditLog() {
        const tbody = document.querySelector('#audit-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        const filtered = auditLog
            .filter(e => !auditFilter ||
                e.actor.toLowerCase().includes(auditFilter.toLowerCase()) ||
                (ACTION_LABELS[e.action] || e.action).includes(auditFilter) ||
                (e.details || '').toLowerCase().includes(auditFilter.toLowerCase()))
            .slice().reverse();
        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">${t('no_data')}</td></tr>`;
            return;
        }
        filtered.forEach(e => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${new Date(e.timestamp).toLocaleString(currentLang === 'ar' ? 'ar-EG' : 'en-US')}</td>
                <td>${e.actor}</td>
                <td><span class="action-tag">${ACTION_LABELS[e.action] || e.action}</span></td>
                <td>${e.details || ''}</td>`;
        });
    }

    function updateCharts() {
        const typeEl = document.getElementById('typeChart');
        const monthEl = document.getElementById('monthlyChart');
        if (!typeEl || !monthEl) return;

        const filtered = filterVacationsByYear(selectedFiscalYear).filter(v => v.username === currentUser);

        const typeCounts = {};
        filtered.forEach(v => { typeCounts[v.type] = (typeCounts[v.type] || 0) + 1; });
        if (typeChartInstance) typeChartInstance.destroy();
        typeChartInstance = new Chart(typeEl.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: Object.keys(typeCounts),
                datasets: [{
                    data: Object.values(typeCounts),
                    backgroundColor: ['#007bff','#28a745','#ffc107','#dc3545','#6f42c1','#fd7e14']
                }]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });

        const monthly = new Array(12).fill(0);
        filtered.forEach(v => { monthly[new Date(v.date).getMonth()]++; });
        if (monthlyChartInstance) monthlyChartInstance.destroy();
        monthlyChartInstance = new Chart(monthEl.getContext('2d'), {
            type: 'bar',
            data: {
                labels: currentLang === 'ar'
                    ? ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
                    : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
                datasets: [{ label: t('monthly_vacations'), data: monthly, backgroundColor: '#007bff' }]
            },
            options: { responsive: true, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
        });

        renderYearlyChart();

        const titleEl = document.getElementById('chart-fiscal-title');
        if (titleEl) {
            titleEl.textContent = selectedFiscalYear === 'all'
                ? t('all_years')
                : t('fiscal_year') + ': ' + getFiscalYearLabel(Number(selectedFiscalYear));
        }
    }

    function renderYearlyChart() {
        const ctx = document.getElementById('yearlyChart');
        if (!ctx) return;
        const byYear = {};
        vacations.filter(v => v.username === currentUser).forEach(v => {
            const fy = getFiscalYear(v.date);
            if (!byYear[fy]) byYear[fy] = { اعتيادية: 0, عارضة: 0, مرضية: 0, أخرى: 0 };
            if (['اعتيادية','عارضة','مرضية'].includes(v.type)) byYear[fy][v.type]++;
            else byYear[fy]['أخرى']++;
        });
        const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);
        const labels = years.map(y => getFiscalYearLabel(y));
        const datasets = [
            { label: currentLang === 'ar' ? 'اعتيادية' : 'Regular', data: years.map(y => byYear[y].اعتيادية),
              borderColor: '#007bff', backgroundColor: 'rgba(0,123,255,0.1)', tension: 0.3, fill: true },
            { label: currentLang === 'ar' ? 'عارضة' : 'Casual', data: years.map(y => byYear[y].عارضة),
              borderColor: '#28a745', backgroundColor: 'rgba(40,167,69,0.1)', tension: 0.3, fill: true },
            { label: currentLang === 'ar' ? 'مرضية' : 'Sick', data: years.map(y => byYear[y].مرضية),
              borderColor: '#dc3545', backgroundColor: 'rgba(220,53,69,0.1)', tension: 0.3, fill: true },
            { label: currentLang === 'ar' ? 'أخرى' : 'Other', data: years.map(y => byYear[y].أخرى),
              borderColor: '#ffc107', backgroundColor: 'rgba(255,193,7,0.1)', tension: 0.3, fill: true }
        ];
        if (yearlyChartInstance) yearlyChartInstance.destroy();
        yearlyChartInstance = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { position: 'bottom' } },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
            }
        });
    }

    function renderAdminSummary() {
        if (!isAdmin) return;

        const userNames = Object.keys(users).filter(u => u !== ADMIN_USERNAME);
        const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setText('stat-total-users', userNames.length);
        setText('stat-total-vacations', vacations.length);
        setText('stat-pending-requests', requests.filter(r => r.status === 'pending').length);
        setText('stat-total-permissions', permissions.length);

        populateFiscalYearFilter(document.getElementById('summary-fiscal-year'), summaryFiscalYear);

        const top = userNames.map(uname => ({
            name: uname, count: vacations.filter(v => v.username === uname).length
        })).sort((a, b) => b.count - a.count).slice(0, 10);

        const topBody = document.querySelector('#top-users-table tbody');
        if (topBody) {
            topBody.innerHTML = '';
            top.forEach((u, i) => {
                const row = topBody.insertRow();
                row.innerHTML = `<td>${i + 1}</td><td>${u.name}</td><td>${u.count}</td>`;
            });
        }

        const summaryBody = document.querySelector('#summary-table tbody');
        if (!summaryBody) return;
        summaryBody.innerHTML = '';
        const filteredVac = (summaryFiscalYear === 'all')
            ? vacations
            : vacations.filter(v => getFiscalYear(v.date) === Number(summaryFiscalYear));
        const filteredPerm = (summaryFiscalYear === 'all')
            ? permissions
            : permissions.filter(p => getFiscalYear(p.date) === Number(summaryFiscalYear));

        userNames
            .filter(u => !summaryFilter || u.toLowerCase().includes(summaryFilter.toLowerCase()))
            .sort()
            .forEach(uname => {
                const u = users[uname];
                const age = calculateAge(u.birthdate);
                const alloc = getAllocatedDays(u.birthdate);
                const uv = filteredVac.filter(v => v.username === uname);
                const usedR = uv.filter(v => v.type === 'اعتيادية').length;
                const usedC = uv.filter(v => v.type === 'عارضة').length;
                const usedS = uv.filter(v => v.type === 'مرضية').length;
                const permCount = filteredPerm.filter(p => p.username === uname).length;

                const row = summaryBody.insertRow();
                row.innerHTML = `
                    <td>${uname}</td><td>${age}</td>
                    <td>${alloc}</td><td>${usedR}</td><td>${Math.max(alloc - usedR, 0)}</td>
                    <td>${usedC}</td><td>${Math.max(CASUAL_DAYS - usedC, 0)}</td>
                    <td>${usedS}</td><td>${Math.max(SICK_DAYS - usedS, 0)}</td>
                    <td>${permCount}</td>`;
            });
    }

    // ====================== المصادقة ======================
    async function login(username, password) {
        const u = users[username];
        if (!u) return false;
        if (u.password !== password) return false;
        currentUser = username;
        isAdmin = (username === ADMIN_USERNAME) || u.role === 'admin';
        sessionStorage.setItem('loggedUser', username);
        return true;
    }

    function logout() {
        logAction('logout', `خروج المستخدم ${currentUser}`);
        stopSessionMonitoring();
        stopAutoSync();
        currentUser = null;
        isAdmin = false;
        sessionStorage.removeItem('loggedUser');
        document.body.classList.remove('is-admin');
        clearNavState();
        loginSection.style.display = 'block';
        appContent.style.display = 'none';
        document.querySelectorAll('#app-content .app-section').forEach(s => s.classList.remove('active'));
    }

    function applyDarkMode(enable) {
        darkMode = enable;
        document.body.classList.toggle('dark-mode', enable);
        const btn = document.getElementById('dark-mode-toggle');
        if (btn) btn.textContent = enable ? '☀️' : '🌙';
        localStorage.setItem('darkMode', enable ? '1' : '0');
    }

    function applySaturdayOff(enable) {
        saturdayOff = enable;
        localStorage.setItem('saturdayOff', enable ? '1' : '0');
        reinitAllFlatpickr();
    }

    function performSearch() {
        const query = document.getElementById('search-username').value.trim();
        const resultsDiv = document.getElementById('search-results');
        resultsDiv.innerHTML = '';
        if (!query || !users[query]) {
            resultsDiv.textContent = t('user_not_found');
            return;
        }
        const u = users[query];
        const age = calculateAge(u.birthdate);
        const alloc = getAllocatedDays(u.birthdate);
        const filteredVac = filterVacationsByYear(searchFiscalYear).filter(v => v.username === query);
        const usedRegular = filteredVac.filter(v => v.type === 'اعتيادية').length;
        const usedCasual = filteredVac.filter(v => v.type === 'عارضة').length;
        const usedSick = filteredVac.filter(v => v.type === 'مرضية').length;
        const yearLabel = searchFiscalYear === 'all' ? t('all_years') : getFiscalYearLabel(Number(searchFiscalYear));

        let html = `
            <div class="search-result-card">
                <h3>${u.name}</h3>
                <p><strong>${t('age')}:</strong> ${age} ${t('years')}</p>
                <p><strong>${t('fiscal_year')}:</strong> ${yearLabel}</p>
                <p><strong>${t('allocated_regular')}:</strong> ${alloc} ${t('days_count')}</p>
                <p><strong>${t('remaining_regular')}:</strong> ${Math.max(alloc - usedRegular, 0)} ${t('days_count')}</p>
                <p><strong>${t('remaining_casual')}:</strong> ${Math.max(CASUAL_DAYS - usedCasual, 0)} ${t('days_count')}</p>
                <p><strong>${t('remaining_sick')}:</strong> ${Math.max(SICK_DAYS - usedSick, 0)} ${t('days_count')}</p>
                <h4>${t('vacation_log')}:</h4>
                <div class="table-responsive">
                <table><thead><tr><th>${t('date')}</th><th>${t('type')}</th></tr></thead><tbody>`;
        if (filteredVac.length === 0) html += `<tr><td colspan="2">${t('no_data')}</td></tr>`;
        else filteredVac.forEach(v => { html += `<tr><td>${v.date}</td><td>${v.type}</td></tr>`; });
        html += '</tbody></table></div></div>';
        resultsDiv.innerHTML = html;
    }

    function exportSettings() {
        const settings = { saturdayOff, darkMode, hijriEnabled, whatsappNumber, holidays,
                           customShortcuts, sessionTimeoutEnabled, sessionDurationMinutes, sessionWarningMinutes,
                           autoBackupEnabled, backupFrequency, autoSyncEnabled,
                           exportedAt: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `settings_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        logAction('export_data', 'تصدير الإعدادات');
    }

    async function importSettings(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            if (typeof data.saturdayOff === 'boolean') {
                saturdayOff = data.saturdayOff;
                document.getElementById('saturday-toggle').checked = saturdayOff;
            }
            if (Array.isArray(data.holidays)) holidays = data.holidays;
            if (typeof data.darkMode === 'boolean') applyDarkMode(data.darkMode);
            if (typeof data.hijriEnabled === 'boolean') {
                hijriEnabled = data.hijriEnabled;
                document.getElementById('hijri-toggle').checked = hijriEnabled;
            }
            if (typeof data.whatsappNumber === 'string') {
                whatsappNumber = data.whatsappNumber;
                localStorage.setItem('whatsappNumber', whatsappNumber);
                const wi = document.getElementById('whatsapp-number');
                if (wi) wi.value = whatsappNumber;
            }
            if (data.customShortcuts) { customShortcuts = data.customShortcuts; saveCustomShortcuts(); renderShortcutsEditor(); }
            if (typeof data.sessionTimeoutEnabled === 'boolean') {
                sessionTimeoutEnabled = data.sessionTimeoutEnabled;
                localStorage.setItem('sessionTimeoutEnabled', sessionTimeoutEnabled ? '1' : '0');
                const st = document.getElementById('session-timeout-toggle');
                if (st) st.checked = sessionTimeoutEnabled;
            }
            if (typeof data.sessionDurationMinutes === 'number') {
                sessionDurationMinutes = data.sessionDurationMinutes;
                localStorage.setItem('sessionDuration', String(sessionDurationMinutes));
                const sd = document.getElementById('session-duration');
                if (sd) sd.value = sessionDurationMinutes;
            }
            if (typeof data.sessionWarningMinutes === 'number') {
                sessionWarningMinutes = data.sessionWarningMinutes;
                localStorage.setItem('sessionWarning', String(sessionWarningMinutes));
                const sw = document.getElementById('session-warning');
                if (sw) sw.value = sessionWarningMinutes;
            }
            if (typeof data.autoBackupEnabled === 'boolean') {
                autoBackupEnabled = data.autoBackupEnabled;
                localStorage.setItem('autoBackupEnabled', autoBackupEnabled ? '1' : '0');
                const ab = document.getElementById('auto-backup-toggle');
                if (ab) ab.checked = autoBackupEnabled;
            }
            if (typeof data.backupFrequency === 'string') {
                backupFrequency = data.backupFrequency;
                localStorage.setItem('backupFrequency', backupFrequency);
                const bf = document.getElementById('backup-frequency');
                if (bf) bf.value = backupFrequency;
            }
            if (typeof data.autoSyncEnabled === 'boolean') {
                autoSyncEnabled = data.autoSyncEnabled;
                localStorage.setItem('autoSyncEnabled', autoSyncEnabled ? '1' : '0');
                const as = document.getElementById('auto-sync-toggle');
                if (as) as.checked = autoSyncEnabled;
                if (autoSyncEnabled) startAutoSync(); else stopAutoSync();
            }
            logAction('import_data', 'استيراد الإعدادات');
            reinitAllFlatpickr();
            showToast(t('imported'), 'success');
            refreshUI();
            updateBackupStatus();
        } catch { await showAlert(t('invalid_file'), t('error'), '❌'); }
    }

    // ============================================================
    //                ربط الأحداث
    // ============================================================

    function setupEventListeners() {

        // تسجيل الدخول
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;

            showConnectionStatus('syncing', t('sync_started'));
            const ok = await loadAllDataFromServer();
            if (!ok) {
                return await showAlert(t('sync_failed'), t('error'), '❌');
            }

            if (await login(username, password)) {
                await logAction('login', `دخول المستخدم ${username}`);
                loginSection.style.display = 'none';
                appContent.style.display = 'block';
                document.body.classList.toggle('is-admin', isAdmin);
                await refreshUI();
                reinitAllFlatpickr();

                if (sessionTimeoutEnabled) startSessionMonitoring();
                if (autoSyncEnabled) startAutoSync();
                if (autoBackupEnabled) { scheduleAutoBackup(); checkAndRunDueBackup(); }
                updateBackupStatus();

                if (!restoreNavState()) navigateTo('user-panel');
                showConnectionStatus('online', t('sync_done'));
            } else {
                await showAlert(t('wrong_credentials'), t('error'), '❌');
            }
        });

        document.getElementById('show-register').addEventListener('click', () => {
            const rf = document.getElementById('register-form');
            rf.style.display = rf.style.display === 'none' ? 'block' : 'none';
        });

        document.getElementById('do-register').addEventListener('click', async () => {
            const name = document.getElementById('reg-username').value.trim();
            const birth = document.getElementById('reg-birthdate').value;
            const pass = document.getElementById('reg-password').value;
            if (!name || !birth || !pass) return await showAlert(t('enter_all_fields'), t('alert'), '⚠️');
            if (users[name]) return await showAlert(t('user_exists'), t('alert'), '⚠️');

            const newUser = { username: name, name, birthdate: birth, password: pass, whatsapp: '', role: 'user' };
            try {
                await api.addUser(newUser);
                users[name] = newUser;
                await logAction('register', `تسجيل مستخدم ${name}`, name);
                await showAlert(t('registered'), t('success'), '✅');
                document.getElementById('register-form').style.display = 'none';
            } catch (err) {
                await showAlert(t('sync_failed') + ': ' + err.message, t('error'), '❌');
            }
        });

        // الإعدادات العامة
        document.getElementById('saturday-toggle').addEventListener('change', (e) => {
            applySaturdayOff(e.target.checked);
            logAction('change_setting', `السبت عطلة: ${e.target.checked}`);
        });
        document.getElementById('dark-mode-toggle').addEventListener('click', () => {
            applyDarkMode(!darkMode);
            logAction('change_setting', `الوضع الداكن: ${darkMode}`);
        });
        document.getElementById('lang-toggle').addEventListener('click', toggleLanguage);
        document.getElementById('hijri-toggle').checked = hijriEnabled;
        document.getElementById('hijri-toggle').addEventListener('change', (e) => applyHijri(e.target.checked));

        const autoSyncToggle = document.getElementById('auto-sync-toggle');
        if (autoSyncToggle) {
            autoSyncToggle.checked = autoSyncEnabled;
            autoSyncToggle.addEventListener('change', (e) => {
                autoSyncEnabled = e.target.checked;
                localStorage.setItem('autoSyncEnabled', autoSyncEnabled ? '1' : '0');
                if (autoSyncEnabled && currentUser) startAutoSync();
                else stopAutoSync();
            });
        }

        document.getElementById('export-settings').addEventListener('click', exportSettings);
        document.getElementById('import-settings-btn').addEventListener('click', () =>
            document.getElementById('import-settings').click());
        document.getElementById('import-settings').addEventListener('change', async (e) => {
            const f = e.target.files[0];
            if (f) await importSettings(f);
            e.target.value = '';
        });

        document.getElementById('reset-shortcuts').addEventListener('click', async () => {
            const ok = await showConfirm(t('reset_shortcuts'), t('confirm'), '⚠️');
            if (!ok) return;
            customShortcuts = JSON.parse(JSON.stringify(DEFAULT_SHORTCUTS));
            saveCustomShortcuts();
            renderShortcutsEditor();
            showToast(t('shortcuts_reset'), 'success');
        });

        // إدارة المستخدمين
        const userForm = document.getElementById('user-form');
        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value.trim();
            const birth = document.getElementById('birthdate').value;
            const pass = document.getElementById('user-password').value;
            const whatsapp = document.getElementById('user-whatsapp').value.trim();
            const editMode = document.getElementById('edit-username').value;

            if (!username || !birth || !pass) return;
            if (new Date(birth) > new Date())
                return await showAlert(t('birthdate_future'), t('error'), '❌');

            try {
                if (editMode) {
                    const oldName = editMode;
                    if (oldName !== username && users[username])
                        return await showAlert(t('user_exists'), t('alert'), '⚠️');

                    const updated = { ...users[oldName], username, name: username, birthdate: birth, password: pass, whatsapp };
                    await api.updateUser(oldName, updated);

                    if (oldName !== username) {
                        delete users[oldName];
                    }
                    users[username] = updated;
                    logAction('edit_user', `تعديل: ${oldName} → ${username}`);

                    document.getElementById('cancel-edit').style.display = 'none';
                    document.getElementById('user-submit-btn').textContent = t('add');
                    document.getElementById('edit-username').value = '';
                } else {
                    if (users[username]) return await showAlert(t('user_exists'), t('alert'), '⚠️');
                    const newUser = { username, name: username, birthdate: birth, password: pass, whatsapp, role: 'user' };
                    await api.addUser(newUser);
                    users[username] = newUser;
                    logAction('add_user', username);
                }
                showToast(t('saved'), 'success');
                userForm.reset();
                refreshUI();
            } catch (err) {
                showToast(t('sync_failed') + ': ' + err.message, 'error');
            }
        });

        document.getElementById('cancel-edit').addEventListener('click', () => {
            document.getElementById('edit-username').value = '';
            document.getElementById('user-submit-btn').textContent = t('add');
            document.getElementById('cancel-edit').style.display = 'none';
            userForm.reset();
        });

        document.getElementById('toggle-user-list').addEventListener('click', () => {
            const lst = document.getElementById('user-list-container');
            lst.style.display = lst.style.display === 'none' ? 'block' : 'none';
        });

        document.getElementById('edit-user-btn').addEventListener('click', () => {
            if (!currentUser || isAdmin) return;
            const u = users[currentUser];
            document.getElementById('username').value = u.name;
            document.getElementById('birthdate').value = u.birthdate;
            document.getElementById('user-password').value = u.password;
            document.getElementById('user-whatsapp').value = u.whatsapp || '';
            document.getElementById('edit-username').value = currentUser;
            document.getElementById('user-submit-btn').textContent = t('update');
            document.getElementById('cancel-edit').style.display = 'inline-block';
            navigateTo('admin-employees');
            goToSubTab('admin-employees', 'tab-manage-users');
        });

        document.getElementById('delete-user-btn').addEventListener('click', async () => {
            if (!currentUser || isAdmin) return;
            const ok = await showConfirm(t('confirm_delete_self', { name: currentUser }), t('delete'), '⚠️');
            if (!ok) return;
            try {
                await api.deleteUser(currentUser);
                logAction('delete_user', currentUser);
                delete users[currentUser];
                vacations = vacations.filter(v => v.username !== currentUser);
                requests = requests.filter(r => r.username !== currentUser);
                permissions = permissions.filter(p => p.username !== currentUser);
                logout();
            } catch (err) { showToast(t('sync_failed'), 'error'); }
        });

        // الإجازات
        document.getElementById('add-date-field').addEventListener('click', () => addDateField());
        addDateField();

        document.getElementById('add-range').addEventListener('click', async () => {
            const start = document.getElementById('range-start').value;
            const end = document.getElementById('range-end').value;
            if (!start || !end) return await showAlert(t('select_dates'), t('alert'), '⚠️');
            if (new Date(start) > new Date(end)) return await showAlert(t('end_before_start'), t('error'), '❌');
            const dates = [];
            let current = new Date(start);
            const last = new Date(end);
            while (current <= last) {
                const str = current.toISOString().slice(0, 10);
                if (isWorkingDay(str)) dates.push(str);
                current.setDate(current.getDate() + 1);
            }
            dates.forEach(d => addDateField(d));
            document.getElementById('range-start').value = '';
            document.getElementById('range-end').value = '';
        });

        document.getElementById('vacation-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) return await showAlert(t('error'), t('error'), '❌');
            const type = document.getElementById('vacation-type').value;
            const dateInputs = document.querySelectorAll('.vacation-date');
            const dates = [];
            dateInputs.forEach(inp => { if (inp.value) dates.push(inp.value); });
            if (dates.length === 0) return await showAlert(t('add_at_least_one'), t('alert'), '⚠️');

            for (const d of dates) {
                if (requests.some(r => r.username === currentUser && r.status === 'pending' && r.dates.includes(d)))
                    return await showAlert(t('date_conflict', { date: d }), t('alert'), '⚠️');
                if (vacations.some(v => v.username === currentUser && v.date === d))
                    return await showAlert(t('date_conflict', { date: d }), t('alert'), '⚠️');
            }

            const u = users[currentUser];
            const alloc = getAllocatedDays(u.birthdate);
            const grouped = {};
            dates.forEach(d => {
                const fy = getFiscalYear(d);
                (grouped[fy] = grouped[fy] || []).push(d);
            });
            for (const fy in grouped) {
                const countToAdd = grouped[fy].length;
                const vacInYear = vacations.filter(v => v.username === currentUser && getFiscalYear(v.date) === Number(fy))
                    .concat(
                        requests.filter(r => r.username === currentUser && r.status === 'pending')
                            .flatMap(r => r.dates.filter(d => getFiscalYear(d) === Number(fy)))
                            .map(d => ({ type, date: d }))
                    );
                const usedInYear = vacInYear.filter(v => v.type === type).length;
                if (type === 'اعتيادية' && usedInYear + countToAdd > alloc)
                    return await showAlert(t('balance_insufficient', { type: t('regular'), year: getFiscalYearLabel(fy), remaining: alloc - usedInYear }), t('alert'), '⚠️');
                if (type === 'عارضة' && usedInYear + countToAdd > CASUAL_DAYS)
                    return await showAlert(t('balance_insufficient', { type: t('casual'), year: getFiscalYearLabel(fy), remaining: CASUAL_DAYS - usedInYear }), t('alert'), '⚠️');
                if (type === 'مرضية' && usedInYear + countToAdd > SICK_DAYS)
                    return await showAlert(t('balance_insufficient', { type: t('sick'), year: getFiscalYearLabel(fy), remaining: SICK_DAYS - usedInYear }), t('alert'), '⚠️');
            }

            const req = {
                username: currentUser, type,
                dates: [...dates].sort(),
                status: isAdmin ? 'approved' : 'pending',
                submittedAt: new Date().toISOString(),
                reviewedAt: isAdmin ? new Date().toISOString() : '',
                reviewedBy: isAdmin ? currentUser : '',
                reviewNote: ''
            };

            try {
                const res = await api.addRequest(apiRequestToRow(req));
                req.id = res.id;
                requests.push(req);

                if (isAdmin) {
                    for (const d of req.dates) {
                        const v = { username: currentUser, date: d, type };
                        const rv = await api.addVacation(v);
                        vacations.push({ ...v, id: rv.id });
                    }
                    await logAction('approve_request', `(ذاتي) ${type} - ${dates.length} يوم`);
                    showToast(t('self_approved'), 'success');
                } else {
                    await logAction('submit_request', `${type} - ${dates.length} يوم`);
                    showToast(t('request_submitted'), 'success');
                }

                document.getElementById('vacation-dates-container').innerHTML = '';
                addDateField();
                refreshUI();
            } catch (err) {
                showToast(t('sync_failed') + ': ' + err.message, 'error');
            }
        });

        // الفلاتر
        document.getElementById('fiscal-year-filter').addEventListener('change', (e) => {
            selectedFiscalYear = e.target.value;
            vacationDisplayLimit = VACATION_PAGE_SIZE;
            refreshUI();
        });
        document.getElementById('search-fiscal-year').addEventListener('change', (e) => {
            searchFiscalYear = e.target.value;
            if (document.getElementById('search-username').value.trim() !== '') performSearch();
        });
        document.getElementById('search-button').addEventListener('click', performSearch);
        document.getElementById('load-more-vacations').addEventListener('click', () => {
            vacationDisplayLimit += VACATION_PAGE_SIZE;
            updateVacationTable();
        });

        // الأذونات
        document.getElementById('permission-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const session = document.getElementById('permission-session').value;
            const dateStr = document.getElementById('permission-date').value;
            if (!dateStr) return await showAlert(t('select_dates'), t('alert'), '⚠️');
            await submitPermission(session, dateStr);
            document.getElementById('permission-form').reset();
        });

        // العطلات
        document.getElementById('holiday-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('holiday-name').value.trim();
            const dateStr = document.getElementById('holiday-date').value;
            if (!name || !dateStr) return;
            await addHoliday(name, dateStr);
            document.getElementById('holiday-form').reset();
        });

        // سجل التدقيق
        document.getElementById('audit-filter').addEventListener('input', (e) => {
            auditFilter = e.target.value;
            renderAuditLog();
        });
        document.getElementById('clear-audit').addEventListener('click', async () => {
            const ok = await showConfirm(t('confirm_clear_audit'), t('clear_log'), '⚠️');
            if (!ok) return;
            try {
                await api.clearAudit();
                auditLog = [];
                await logAction('clear_audit', 'تم مسح السجل');
                renderAuditLog();
                showToast(t('deleted'), 'success');
            } catch (err) { showToast(t('sync_failed'), 'error'); }
        });

        // ملخص المشرف
        document.getElementById('summary-filter').addEventListener('input', (e) => {
            summaryFilter = e.target.value;
            renderAdminSummary();
        });
        document.getElementById('summary-fiscal-year').addEventListener('change', (e) => {
            summaryFiscalYear = e.target.value;
            renderAdminSummary();
        });

        // واتساب
        const wn = document.getElementById('whatsapp-number');
        if (wn) {
            wn.value = whatsappNumber;
            document.getElementById('save-whatsapp').addEventListener('click', () => {
                whatsappNumber = wn.value.trim();
                localStorage.setItem('whatsappNumber', whatsappNumber);
                showToast(t('saved'), 'success');
            });
            document.getElementById('test-whatsapp').addEventListener('click', () => {
                const num = wn.value.trim();
                if (!num) return showAlert(t('no_whatsapp_number'), t('alert'), '⚠️');
                openWhatsApp(num, currentLang === 'ar'
                    ? '🧪 هذه رسالة اختبار من نظام إدارة الإجازات.'
                    : '🧪 Test message from Leave Management System.');
            });
        }

        // زر المزامنة
        const syncBtn = document.getElementById('sync-btn');
        if (syncBtn) syncBtn.addEventListener('click', manualSync);

        // تراجع/إعادة
        document.getElementById('undo').addEventListener('click', async () => {
            if (undoStack.length === 0) return;
            redoStack.push({
                users: JSON.parse(JSON.stringify(users)),
                vacations: JSON.parse(JSON.stringify(vacations)),
                requests: JSON.parse(JSON.stringify(requests)),
                permissions: JSON.parse(JSON.stringify(permissions)),
                holidays: JSON.parse(JSON.stringify(holidays))
            });
            const prev = undoStack.pop();
            users = prev.users; vacations = prev.vacations;
            requests = prev.requests; permissions = prev.permissions;
            holidays = prev.holidays;
            if (currentUser && !users[currentUser]) { logout(); return; }
            refreshUI();
        });
        document.getElementById('redo').addEventListener('click', async () => {
            if (redoStack.length === 0) return;
            undoStack.push({
                users: JSON.parse(JSON.stringify(users)),
                vacations: JSON.parse(JSON.stringify(vacations)),
                requests: JSON.parse(JSON.stringify(requests)),
                permissions: JSON.parse(JSON.stringify(permissions)),
                holidays: JSON.parse(JSON.stringify(holidays))
            });
            const next = redoStack.pop();
            users = next.users; vacations = next.vacations;
            requests = next.requests; permissions = next.permissions;
            holidays = next.holidays;
            if (currentUser && !users[currentUser]) { logout(); return; }
            refreshUI();
        });

        // حفظ / تصدير / استيراد
        document.getElementById('save').addEventListener('click', () => manualSync());
        const forceSyncBtn = document.getElementById('force-sync');
        if (forceSyncBtn) forceSyncBtn.addEventListener('click', manualSync);

        document.getElementById('export-excel').addEventListener('click', () => {
            const data = [];
            for (const uname in users) {
                if (uname === ADMIN_USERNAME) continue;
                const u = users[uname];
                const uVac = vacations.filter(v => v.username === uname);
                const age = calculateAge(u.birthdate);
                const alloc = getAllocatedDays(u.birthdate);
                data.push({
                    'الاسم': u.name, 'العمر': age, 'رصيد اعتيادي': alloc,
                    'اعتيادي مستخدم': uVac.filter(v => v.type === 'اعتيادية').length,
                    'عارضة': uVac.filter(v => v.type === 'عارضة').length,
                    'مرضية': uVac.filter(v => v.type === 'مرضية').length,
                    'أخرى': uVac.filter(v => !['اعتيادية','عارضة','مرضية'].includes(v.type)).length
                });
            }
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "ملخص");
            XLSX.writeFile(wb, "VacationReport.xlsx");
            logAction('export_data', 'تصدير Excel');
        });

        document.getElementById('export-pdf').addEventListener('click', () => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const filtered = filterVacationsByYear(selectedFiscalYear).filter(v => v.username === currentUser);
            const rows = filtered.map(v => [v.date, v.type]);
            doc.autoTable({ head: [[t('date'), t('type')]], body: rows, startY: 20, styles: { halign: 'right' } });
            doc.save(`${currentUser}_vacations.pdf`);
            logAction('export_data', 'تصدير PDF');
        });

        document.getElementById('save-as').addEventListener('click', () => {
            const blob = new Blob([JSON.stringify({
                users: Object.values(users), vacations, requests, permissions, holidays
            })], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'backup.json';
            a.click();
            logAction('export_data', 'تصدير JSON');
        });

        document.getElementById('import').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                const ok = await showConfirm(
                    currentLang === 'ar'
                        ? 'سيتم استبدال جميع البيانات في Google Sheets. هل أنت متأكد؟'
                        : 'All data in Google Sheets will be replaced. Continue?',
                    t('confirm'), '⚠️');
                if (!ok) return;

                await api.replaceAllData({
                    users: data.users || [],
                    vacations: data.vacations || [],
                    requests: data.requests || [],
                    permissions: data.permissions || [],
                    holidays: data.holidays || [],
                    auditLog: data.auditLog || []
                });

                await loadAllDataFromServer();
                await logAction('import_data', 'استيراد البيانات الكاملة');
                showToast(t('imported'), 'success');
                refreshUI();
            } catch (err) {
                await showAlert(t('invalid_file'), t('error'), '❌');
            }
            e.target.value = '';
        });

        // الطباعة
        document.getElementById('print-report').addEventListener('click', () => {
            const cards = document.querySelectorAll('#app-content .card');
            const hidden = [];
            cards.forEach(c => {
                if (c.id !== 'reports-card') { hidden.push([c, c.style.display]); c.style.display = 'none'; }
            });
            window.print();
            hidden.forEach(([el, disp]) => el.style.display = disp);
        });

        document.getElementById('print-summary').addEventListener('click', () => {
            const cards = document.querySelectorAll('#app-content .card');
            const hidden = [];
            cards.forEach(c => {
                if (c.id !== 'admin-summary-card') { hidden.push([c, c.style.display]); c.style.display = 'none'; }
            });
            window.print();
            hidden.forEach(([el, disp]) => el.style.display = disp);
        });
    }

    // ============================================================
    //                بدء التشغيل
    // ============================================================
    async function init() {
        saturdayOff = localStorage.getItem('saturdayOff') !== '0';
        document.getElementById('saturday-toggle').checked = saturdayOff;

        darkMode = localStorage.getItem('darkMode') === '1';
        applyDarkMode(darkMode);

        hijriEnabled = localStorage.getItem('hijriEnabled') === '1';
        const ht = document.getElementById('hijri-toggle');
        if (ht) ht.checked = hijriEnabled;

        autoSyncEnabled = localStorage.getItem('autoSyncEnabled') !== '0';
        const ast = document.getElementById('auto-sync-toggle');
        if (ast) ast.checked = autoSyncEnabled;

        whatsappNumber = localStorage.getItem('whatsappNumber') || '';

        loadCustomShortcuts();
        await initI18n();

        setupEventListeners();
        initNavigation();
        initSubTabs();
        initKeyboardShortcuts();
        renderShortcutsEditor();
        initSession();
        initAutoBackup();
        initApiSettings();
        initNetworkMonitor();

        try {
            await api.ping();
            connectionOnline = true;
        } catch (err) {
            connectionOnline = false;
            console.warn('Cannot reach backend:', err.message);
        }

        const loggedUser = sessionStorage.getItem('loggedUser');
        if (loggedUser && connectionOnline) {
            const ok = await loadAllDataFromServer();
            if (ok && users[loggedUser]) {
                currentUser = loggedUser;
                isAdmin = (loggedUser === ADMIN_USERNAME) || users[loggedUser].role === 'admin';
                loginSection.style.display = 'none';
                appContent.style.display = 'block';
                document.body.classList.toggle('is-admin', isAdmin);
                reinitAllFlatpickr();
                await refreshUI();

                if (sessionTimeoutEnabled) startSessionMonitoring();
                if (autoSyncEnabled) startAutoSync();
                if (autoBackupEnabled) { scheduleAutoBackup(); checkAndRunDueBackup(); }
                updateBackupStatus();

                if (!restoreNavState()) navigateTo('user-panel');
            } else {
                loginSection.style.display = 'block';
                appContent.style.display = 'none';
            }
        } else {
            loginSection.style.display = 'block';
            appContent.style.display = 'none';
        }

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(() => {});
        }
    }

    init();
});
