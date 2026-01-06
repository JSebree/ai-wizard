import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../libs/supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!supabase) {
            console.error("[AuthContext] Supabase client is missing");
            setLoading(false);
            return;
        }

        // Get initial session
        const initSession = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) {
                    console.error("[AuthContext] getSession error:", error);
                } else {
                    setSession(session);
                    setUser(session?.user ?? null);
                    console.log("[AuthContext] Session loaded:", session?.user?.email || "no user");
                }
            } catch (e) {
                console.error("[AuthContext] initSession error:", e);
            } finally {
                setLoading(false);
            }
        };

        initSession();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log("[AuthContext] Auth state changed:", event);
                setSession(session);
                setUser(session?.user ?? null);
            }
        );

        return () => {
            subscription?.unsubscribe();
        };
    }, []);

    // Sign in with Google
    const signInWithGoogle = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`
            }
        });

        if (error) {
            console.error("[AuthContext] signInWithGoogle error:", error);
            return { error };
        }
        return { error: null };
    };

    // Sign up with email/password
    const signUp = async (email, password, name) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
                data: {
                    full_name: name,
                    name: name
                }
            }
        });
        if (error) {
            console.error("[AuthContext] signUp error:", error);
        }
        return { data, error };
    };

    // Sign in with email/password
    const signInWithEmail = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        if (error) {
            console.error("[AuthContext] signInWithEmail error:", error);
        }
        return { data, error };
    };

    // Sign out
    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error("[AuthContext] signOut error:", error);
        }
    };

    const value = {
        user,
        session,
        loading,
        signInWithGoogle,
        signUp,
        signInWithEmail,
        signOut,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
