import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, Music2 } from "lucide-react";
import axios from "axios";

function Login() {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!email || !password) {
            setError("Please enter your email and password.");
            return;
        }

        try {
            setLoading(true);
            setError("");

            const response = await axios.post(
                "http://localhost:5000/api/login",
                {
                    email,
                    password,
                }
            );

            const { token, user } = response.data;

            localStorage.setItem("token", token);
            localStorage.setItem("user", JSON.stringify(user));

            navigate("/home");
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Login failed. Please check your email and password."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">

            {/* Left side */}
            <section className="auth-brand-section">

                <div className="brand">
                    <div className="brand-icon">
                        <Music2 size={21} />
                    </div>

                    <span>TUNED</span>
                </div>

                <div className="brand-content">

                    <p className="eyebrow">
                        YOUR MUSIC. YOUR TASTE.
                    </p>

                    <h1>
                        Discover music.
                        <br />
                        <span>Rate what you love.</span>
                    </h1>

                    <p className="brand-description">
                        Find songs, share your taste, rate your favorites,
                        and discover what other music lovers are listening to.
                    </p>

                </div>

                <div className="brand-footer">
                    <span>Listen.</span>
                    <span>Rate.</span>
                    <span>Discover.</span>
                </div>

            </section>

            {/* Right side */}
            <section className="auth-form-section">

                <div className="auth-container">

                    <div className="mobile-brand">
                        <div className="brand-icon">
                            <Music2 size={20} />
                        </div>

                        <span>TUNED</span>
                    </div>

                    <div className="auth-heading">

                        <p className="small-label">
                            WELCOME BACK
                        </p>

                        <h2>Sign in to Tuned</h2>

                        <p>
                            Continue discovering music you love.
                        </p>

                    </div>

                    <form onSubmit={handleSubmit}>

                        {/* Email */}
                        <div className="input-group">

                            <label htmlFor="email">
                                Email
                            </label>

                            <div className="input-wrapper">

                                <Mail size={19} />

                                <input
                                    id="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        setError("");
                                    }}
                                    autoComplete="email"
                                />

                            </div>

                        </div>

                        {/* Password */}
                        <div className="input-group">

                            <label htmlFor="password">
                                Password
                            </label>

                            <div className="input-wrapper">

                                <Lock size={19} />

                                <input
                                    id="password"
                                    type={
                                        showPassword
                                            ? "text"
                                            : "password"
                                    }
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        setError("");
                                    }}
                                    autoComplete="current-password"
                                />

                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() =>
                                        setShowPassword(!showPassword)
                                    }
                                >
                                    {showPassword ? (
                                        <EyeOff size={18} />
                                    ) : (
                                        <Eye size={18} />
                                    )}
                                </button>

                            </div>

                        </div>

                        {/* Error */}
                        {error && (
                            <div className="auth-error">
                                {error}
                            </div>
                        )}

                        {/* Login button */}
                        <button
                            type="submit"
                            className="login-button"
                            disabled={loading}
                        >
                            {loading
                                ? "Signing in..."
                                : "Sign in"}
                        </button>

                    </form>

                    <div className="register-prompt">

                        <span>
                            Don't have an account?
                        </span>

                        <Link to="/register">
                            Create one
                        </Link>

                    </div>

                </div>

            </section>

        </div>
    );
}

export default Login;