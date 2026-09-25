/* ============================================================
   api.js - طبقة الاتصال بـ Google Apps Script Backend
   الإصدار المُصحّح v8 - يتجنب CORS
   ============================================================ */

const API_CONFIG = {
    BASE_URL: localStorage.getItem('apiBaseUrl') ||
              'https://script.google.com/macros/s/AKfycbw9E2qVOs6gBlyjcixpaQyRWV2yCVohNxpQ25_9w-LanJ5jyQL_3Qg39NN1MOdJdKE/exec',

    TOKEN: localStorage.getItem('apiToken') ||
           'VacationApp_Alexandria_2026_SecretToken_v1',

    TIMEOUT: 30000
};

const api = {
    setConfig(url, token) {
        if (url) {
            API_CONFIG.BASE_URL = url.trim();
            localStorage.setItem('apiBaseUrl', API_CONFIG.BASE_URL);
        }
        if (token) {
            API_CONFIG.TOKEN = token.trim();
            localStorage.setItem('apiToken', API_CONFIG.TOKEN);
        }
    },

    getConfig() {
        return { url: API_CONFIG.BASE_URL, token: API_CONFIG.TOKEN };
    },

    resetConfig() {
        localStorage.removeItem('apiBaseUrl');
        localStorage.removeItem('apiToken');
    },

    // ============ طلب موحّد ============
    // جميع الطلبات تُرسل كـ POST مع text/plain لتجنب preflight
    async request(action, data = {}) {
        return this._fetch(API_CONFIG.BASE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action,
                token: API_CONFIG.TOKEN,
                ...data
            })
        });
    },

    // ============ Fetch with timeout ============
    async _fetch(url, options) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

        try {
            const res = await fetch(url, {
                ...options,
                redirect: 'follow',
                signal: controller.signal
            });
            clearTimeout(timer);

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }

            const text = await res.text();
            let json;
            try {
                json = JSON.parse(text);
            } catch {
                console.error('Raw response:', text.substring(0, 500));
                throw new Error('استجابة غير صالحة من الخادم (ليست JSON)');
            }

            if (!json.ok) throw new Error(json.error || 'خطأ من الخادم');
            return json.data;
        } catch (err) {
            clearTimeout(timer);
            if (err.name === 'AbortError') throw new Error('انتهت مهلة الاتصال بالخادم');
            throw err;
        }
    },

    // ============ Endpoints ============
    async ping() { return this.request('ping'); },
    async getAllData() { return this.request('getAll'); },

    async getUsers() { return this.request('getUsers'); },
    async getVacations() { return this.request('getVacations'); },
    async getRequests() { return this.request('getRequests'); },
    async getPermissions() { return this.request('getPermissions'); },
    async getHolidays() { return this.request('getHolidays'); },
    async getAuditLog() { return this.request('getAuditLog'); },

    async addUser(user) { return this.request('addUser', { user }); },
    async updateUser(oldUsername, user) { return this.request('updateUser', { username: oldUsername, user }); },
    async deleteUser(username) { return this.request('deleteUser', { username }); },

    async addVacation(v) { return this.request('addVacation', { vacation: v }); },
    async deleteVacation(id) { return this.request('deleteVacation', { id }); },

    async addRequest(r) { return this.request('addRequest', { request: r }); },
    async updateRequest(id, r) { return this.request('updateRequest', { id, request: r }); },
    async deleteRequest(id) { return this.request('deleteRequest', { id }); },

    async addPermission(p) { return this.request('addPermission', { permission: p }); },
    async deletePermission(id) { return this.request('deletePermission', { id }); },

    async addHoliday(h) { return this.request('addHoliday', { holiday: h }); },
    async deleteHoliday(id) { return this.request('deleteHoliday', { id }); },

    async addAudit(entry) { return this.request('addAudit', { entry }); },
    async clearAudit() { return this.request('clearAudit'); },
    async replaceAllData(data) { return this.request('replaceAll', { data }); }
};

function apiRequestToRow(r) {
    return { ...r, dates: Array.isArray(r.dates) ? r.dates.join('|') : (r.dates || '') };
}

function apiRowToRequest(r) {
    return {
        ...r,
        id: String(r.id),
        dates: typeof r.dates === 'string'
            ? r.dates.split('|').filter(Boolean)
            : (Array.isArray(r.dates) ? r.dates : [])
    };
}
