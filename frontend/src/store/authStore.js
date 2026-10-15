import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useAuthStore = create(
    persist(
        (set) => ({
            user: null,
            token: null,
            isAuthenticated: false,

            login: (user, token) => {
                sessionStorage.setItem('token', token);
                // Clear any permanent localStorage cache
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('auth-storage');
                set({ user, token, isAuthenticated: true });
            },

            logout: () => {
                sessionStorage.removeItem('token');
                sessionStorage.removeItem('user');
                sessionStorage.removeItem('auth-storage');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('auth-storage');
                set({ user: null, token: null, isAuthenticated: false });
            },

            updateUser: (user) => set({ user }),

            setUser: (user) => set({ user }),
        }),
        {
            name: 'auth-storage',
            storage: createJSONStorage(() => sessionStorage),
        }
    )
);