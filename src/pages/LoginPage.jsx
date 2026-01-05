import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

export default function LoginPage() {
    const { user, loading, signInWithGoogle, signUp, signInWithEmail } = useAuth();
    const [isSignUp, setIsSignUp] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // If already logged in, redirect to home
    if (!loading && user) {
        return <Navigate to="/" replace />;
    }

    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setSubmitting(true);

        if (isSignUp) {
            const { error } = await signUp(email, password, name);
            if (error) {
                setError(error.message);
            } else {
                setMessage('Check your email for a confirmation link!');
            }
        } else {
            const { error } = await signInWithEmail(email, password);
            if (error) {
                setError(error.message);
            }
        }

        setSubmitting(false);
    };

    return (
        <div className="min-h-[60vh] flex items-center justify-center px-4">
            <div className="w-full max-w-md p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
                <h1 className="text-2xl font-bold text-center mb-2 text-gray-900 dark:text-white">
                    {isSignUp ? 'Create an account' : 'Sign in to SceneMe'}
                </h1>

                <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
                    {isSignUp ? 'Start creating and saving your work' : 'Sign in to save and manage your creations'}
                </p>

                {/* Google OAuth Button */}
                <button
                    onClick={signInWithGoogle}
                    disabled={loading || submitting}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 
                               bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 
                               rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 
                               transition-colors disabled:opacity-50"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    <span className="text-gray-700 dark:text-gray-200 font-medium">
                        Continue with Google
                    </span>
                </button>

                {/* Divider */}
                <div className="flex items-center gap-4 my-6">
                    <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">or</span>
                    <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                </div>

                {/* Email/Password Form */}
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                    {/* Name field - only show on sign up */}
                    {isSignUp && (
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Name
                            </label>
                            <input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                           focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Your name"
                            />
                        </div>
                    )}

                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                       focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="you@example.com"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                       focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="••••••••"
                        />
                    </div>

                    {error && (
                        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                    )}

                    {message && (
                        <p className="text-green-600 dark:text-green-400 text-sm">{message}</p>
                    )}

                    <button
                        type="submit"
                        disabled={loading || submitting}
                        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium 
                                   rounded-lg transition-colors disabled:opacity-50"
                    >
                        {submitting ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
                    </button>
                </form>

                {/* Toggle Sign Up / Sign In */}
                <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
                    {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                    <button
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setError('');
                            setMessage('');
                        }}
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
                    >
                        {isSignUp ? 'Sign in' : 'Sign up'}
                    </button>
                </p>
            </div>
        </div>
    );
}
