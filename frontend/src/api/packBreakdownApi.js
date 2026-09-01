import api from './axios';

export const packBreakdownApi = {
    unpack: async (data) => (await api.post('/stock/pack-breakdowns', data)).data,
    getHistory: async (params = {}) => (await api.get('/stock/pack-breakdowns/history', { params })).data,
};
