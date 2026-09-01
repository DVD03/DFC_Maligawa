import api from './axios';

export const bakeryApi = {
    listTemplates: async () => (await api.get('/bakery/templates')).data,
    getTemplate: async (supplierId) => (await api.get(`/bakery/templates/${supplierId}`)).data,
    saveTemplate: async (supplierId, data) => (await api.post(`/bakery/templates/${supplierId}`, data)).data,
    getBalance: async (supplierId) => (await api.get(`/bakery/balance/${supplierId}`)).data,
    createDailyEntry: async (data) => (await api.post('/bakery/entries', data)).data,
    getDailyEntries: async (params = {}) => (await api.get('/bakery/entries', { params })).data,
    getDailyEntryById: async (id) => (await api.get(`/bakery/entries/${id}`)).data,
    getSupplierStatement: async (supplierId, params = {}) => (await api.get(`/bakery/statement/${supplierId}`, { params })).data,
    recordPayment: async (data) => (await api.post('/bakery/payments', data)).data,
    recordEntryPayment: async (entryId, data) => (await api.post(`/bakery/entries/${entryId}/payment`, data)).data,
    getStockLevels: async (params = {}) => (await api.get('/bakery/stock', { params })).data,
};
