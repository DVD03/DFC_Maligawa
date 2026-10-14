export const ROLES = [
    {
        value: 'admin',
        label: 'Administrator',
        description: 'Full system access, can manage users and all operations',
        color: '#dc2626',
        permissions: ['all'],
    },
    {
        value: 'manager',
        label: 'Manager',
        description: 'Operational oversight, approvals, most actions allowed',
        color: '#ea580c',
        permissions: ['approve_orders', 'approve_credits', 'manage_products', 'view_reports'],
    },
    {
        value: 'accountant',
        label: 'Accountant',
        description: 'Handles invoicing, payments, credit control',
        color: '#059669',
        permissions: ['invoicing', 'payments', 'credit_holds', 'view_financial_reports'],
    },
    {
        value: 'sales_manager',
        label: 'Sales Manager',
        description: 'Manages sales team, orders, customer relationships',
        color: '#2563eb',
        permissions: ['approve_orders', 'manage_customers', 'view_sales_reports'],
    },
    {
        value: 'sales_rep',
        label: 'Sales Rep',
        description: 'Creates orders, manages assigned customers only',
        color: '#7c3aed',
        permissions: ['create_orders', 'view_own_customers'],
    },
    {
        value: 'warehouse_staff',
        label: 'Warehouse Staff',
        description: 'Handles stock, dispatch, and goods receipt',
        color: '#0891b2',
        permissions: ['manage_stock', 'dispatch_orders', 'receive_grn'],
    },
    {
        value: 'production_staff',
        label: 'Production Staff',
        description: 'Manages BOMs and production orders',
        color: '#c026d3',
        permissions: ['manage_bom', 'run_production'],
    },
    {
        value: 'inventory_admin',
        label: 'Inventory Admin',
        description: 'Exclusive access to adjust stock levels and manage catalog',
        color: '#b91c1c',
        permissions: ['adjust_stock', 'manage_stock', 'manage_products'],
    },
    {
        value: 'cashier',
        label: 'Cashier',
        description: 'POS sales terminal, customer checkout, and register sessions',
        color: '#10b981',
        permissions: ['pos_sales', 'create_orders'],
    },
    {
        value: 'staff',
        label: 'Staff',
        description: 'View-only access to most modules',
        color: '#64748b',
        permissions: ['view_only'],
    },
];

export const getRoleConfig = (roleValue) =>
    ROLES.find((r) => r.value === roleValue) || ROLES[ROLES.length - 1];