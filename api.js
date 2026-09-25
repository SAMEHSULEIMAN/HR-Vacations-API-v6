/* ============================================================
   api.js - طبقة الاتصال بـ Google Apps Script Backend
   الإصدار المُصحّح v7
   ============================================================ */

const API_CONFIG = {
    // رابط /exec الصحيح (ليس /dev)
    BASE_URL: localStorage.getItem('apiBaseUrl') ||
              'https://script.google.com/macros/s/AKfycbw9E2qVOs6gBlyjcixpaQyRWV2yCVohNxpQ25_9w-LanJ5jyQL_3Qg39NN1MOdJdKE/exec',

    // ⚠️ رمز المصادقة — يجب أن يطابق SECRET_TOKEN في Apps Script
    TOKEN: localStorage.getItem('apiToken') ||
           'VacationApp_Alexandria_2026_SecretToken_v1',

    TIMEOUT: 20000
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

    async get(action, params = {}) {
        const qs = new URLSearchParams({
            action,
            token: API_CONFIG.TOKEN,
            ...params
        }).toString();
        return this._fetch(`${API_CONFIG.BASE_URL}?${qs}`, { method: 'GET' });
    },

    async post(action, data = {}) {
        return this._fetch(API_CONFIG.BASE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action, token: API_CONFIG.TOKEN, ...data })
        });
    },

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

            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

            const text = await res.text();
            let json;
            try {
                json = JSON.parse(text);
            } catch {
                console.error('Raw response:', text.substring(0, 300));
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

    async ping() { return this.get('ping'); },
    async getAllData() { return this.get('getAll'); },

    async getUsers() { return this.get('getUsers'); },
    async getVacations() { return this.get('getVacations'); },
    async getRequests() { return this.get('getRequests'); },
    async getPermissions() { return this.get('getPermissions'); },
    async getHolidays() { return this.get('getHolidays'); },
    async getAuditLog() { return this.get('getAuditLog'); },

    async addUser(user) { return this.post('addUser', { user }); },
    async updateUser(oldUsername, user) { return this.post('updateUser', { username: oldUsername, user }); },
    async deleteUser(username) { return this.post('deleteUser', { username }); },

    async addVacation(v) { return this.post('addVacation', { vacation: v }); },
    async deleteVacation(id) { return this.post('deleteVacation', { id }); },

    async addRequest(r) { return this.post('addRequest', { request: r }); },
    async updateRequest(id, r) { return this.post('updateRequest', { id, request: r }); },
    async deleteRequest(id) { return this.post('deleteRequest', { id }); },

    async addPermission(p) { return this.post('addPermission', { permission: p }); },
    async deletePermission(id) { return this.post('deletePermission', { id }); },

    async addHoliday(h) { return this.post('addHoliday', { holiday: h }); },
    async deleteHoliday(id) { return this.post('deleteHoliday', { id }); },

    async addAudit(entry) { return this.post('addAudit', { entry }); },
    async clearAudit() { return this.post('clearAudit'); },
    async replaceAllData(data) { return this.post('replaceAll', { data }); }
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
