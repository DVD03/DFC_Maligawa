import api from './axios';

export const employeeWageApi = {
    recordWagePayment: async (data) => (await api.post('/hr/wages', data)).data,
    getAdvanceBalance: async (employeeId) => (await api.get(`/hr/wages/advance-balance/${employeeId}`)).data,
    list: async (params = {}) => (await api.get('/hr/wages', { params })).data,
    getById: async (id) => (await api.get(`/hr/wages/${id}`)).data,
};
