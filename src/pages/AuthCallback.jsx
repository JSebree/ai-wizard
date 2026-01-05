import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AuthCallback() {
    const navigate = useNavigate();

    useEffect(() => {
        // The Supabase SDK will automatically handle the OAuth callback
        // and update the session via onAuthStateChange in AuthContext.
        // We just need to redirect the user after a short delay.

        console.log("[AuthCallback] OAuth callback received, redirecting...");

        // Small delay to ensure the session is processed
        const timer = setTimeout(() => {
            navigate('/', { replace: true });
        }, 500);

        return () => clearTimeout(timer);
    }, [navigate]);

    return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Completing sign in...</p>
            </div>
        </div>
    );
}
