"use client";

import { useState } from "react";

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    login: (u: string, p: string) => Promise<any>;
    register: (u: string, p: string) => Promise<any>;
}

export function AuthModal({ isOpen, onClose, onSuccess, login, register }: AuthModalProps) {
    // const { login, register } = useAuth(); // Removed
    const [isLogin, setIsLogin] = useState(false);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);

        const action = isLogin ? login : register;
        const result = await action(username, password);

        setLoading(false);

        if (result.success) {
            onSuccess();
            onClose();
        } else {
            setError(result.error || "Authentication failed");
        }
    }

    return (
        <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-card">
                <p className="label">{isLogin ? "Welcome Back" : "Claim Your Name"}</p>
                <h2 className="modal-title">
                    {isLogin ? "Login to WordOff" : "Create a Profile"}
                </h2>
                <p className="modal-subtitle">
                    {isLogin
                        ? "Enter your credentials to sync progress."
                        : "Pick a unique name and password to secure your progress."}
                </p>

                <form onSubmit={handleSubmit} className="modal-form">
                    <input
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        minLength={3}
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={4}
                    />

                    {error && <p style={{ color: "var(--accent-deep)", fontSize: "14px" }}>{error}</p>}

                    <div className="modal-actions">
                        <button className="primary" type="submit" disabled={loading}>
                            {loading ? "Loading..." : isLogin ? "Login" : "Claim Name"}
                        </button>
                        <button
                            className="ghost"
                            type="button"
                            onClick={() => setIsLogin(!isLogin)}
                        >
                            {isLogin ? "Need an account?" : "Have an account?"}
                        </button>
                        <button className="ghost" type="button" onClick={onClose}>
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
