import api from '../../api/axios';

export const financialReportsApi = {
    getProfitAndLoss: async (params) => {
        const res = await api.get('/financial-reports/profit-and-loss', { params });
        return res.data;
    },
    getSnapshot: async (params) => {
        const res = await api.get('/reports/financial/snapshot', { params });
        return res.data;
    },
};
