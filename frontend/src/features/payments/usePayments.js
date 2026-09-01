import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { paymentsApi } from './paymentsApi';

export const usePayments = (filters = {}) => useQuery({
    queryKey: ['payments', filters],
    queryFn: () => paymentsApi.list(filters),
    placeholderData: (prev) => prev,
});

export const useCreatePayment = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: paymentsApi.create,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['payments'] });
            qc.invalidateQueries({ queryKey: ['invoices'] });
            qc.invalidateQueries({ queryKey: ['invoicesAging'] });
            qc.invalidateQueries({ queryKey: ['bills'] });
            qc.invalidateQueries({ queryKey: ['payablesAging'] });
            qc.invalidateQueries({ queryKey: ['customers'] });
            qc.invalidateQueries({ queryKey: ['suppliers'] });
            qc.invalidateQueries({ queryKey: ['supplier-balance'] });
            qc.invalidateQueries({ queryKey: ['bank-accounts'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
            qc.invalidateQueries({ queryKey: ['financial-pnl'] });
            qc.invalidateQueries({ queryKey: ['financialReports'] });
            toast.success('Payment recorded');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
    });
};

export const useDeletePayment = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: paymentsApi.delete,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['payments'] });
            qc.invalidateQueries({ queryKey: ['invoices'] });
            qc.invalidateQueries({ queryKey: ['invoicesAging'] });
            qc.invalidateQueries({ queryKey: ['bills'] });
            qc.invalidateQueries({ queryKey: ['payablesAging'] });
            qc.invalidateQueries({ queryKey: ['customers'] });
            qc.invalidateQueries({ queryKey: ['suppliers'] });
            qc.invalidateQueries({ queryKey: ['supplier-balance'] });
            qc.invalidateQueries({ queryKey: ['bank-accounts'] });
            qc.invalidateQueries({ queryKey: ['cheques'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
            qc.invalidateQueries({ queryKey: ['financial-pnl'] });
            qc.invalidateQueries({ queryKey: ['financialReports'] });
            toast.success('Payment deleted & balances restored');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Delete failed'),
    });
};