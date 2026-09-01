import { useNavigate } from 'react-router-dom';
import { LogOut, User as UserIcon, Menu } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../features/auth/authApi';

export default function Header({ onToggleSidebar }) {
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();

    const handleLogout = async () => {
        try {
            await authApi.logout();
        } catch (err) {
            // Even if backend fails, log out locally
        }
        logout();
        toast.success('Logged out successfully');
        navigate('/login');
    };

    const roleLabel = {
        admin: 'Administrator',
        manager: 'Manager',
        accountant: 'Accountant',
        sales_manager: 'Sales Manager',
        sales_rep: 'Sales Rep',
        warehouse_staff: 'Warehouse Staff',
        production_staff: 'Production Staff',
        staff: 'Staff',
    }[user?.role] || 'User';

    return (
        <header className="h-14 sm:h-16 bg-white border-b border-gray-100 flex items-center justify-between px-3 sm:px-6 flex-shrink-0 z-20">
            <div className="flex items-center gap-2 sm:gap-3">
                {/* Hamburger toggle */}
                <button
                    onClick={onToggleSidebar}
                    className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition"
                    aria-label="Toggle sidebar"
                >
                    <Menu size={22} />
                </button>
                <div className="hidden sm:block">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-tight">Workspace</p>
                    <h1 className="text-sm font-bold text-gray-900 leading-tight">
                        Main Branch
                    </h1>
                </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
                <div 
                    onClick={() => navigate('/profile')}
                    className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1 sm:py-1.5 bg-gray-50/70 hover:bg-gray-100/80 cursor-pointer border border-gray-100 rounded-xl transition"
                >
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white border border-gray-100 rounded-full flex items-center justify-center shadow-sm">
                        <UserIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
                    </div>
                    <div className="hidden sm:block text-sm">
                        <p className="font-bold text-gray-900 leading-none">{user?.fullName}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter mt-0.5">{roleLabel}</p>
                    </div>
                </div>

                <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm text-gray-700 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition"
                    title="Logout"
                >
                    <LogOut size={16} />
                    <span className="hidden sm:inline font-medium">Logout</span>
                </button>
            </div>
        </header>
    );
}