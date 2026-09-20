import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Mail, Lock, Eye, EyeOff, Music2 } from "lucide-react";
import axios from "axios";
import API_URL from "../api";

function Register() {
    const navigate = useNavigate();

    const [form, setForm] = useState({
        name: "",
        email: "",
        password: "",
    });

    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleChange = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value,
        });

        setError("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.name || !form.email || !form.password) {
            setError("Please fill in all fields.");
            return;
        }

        if (form.password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }

        try {
            setLoading(true);
            setError("");

            await axios.post(`${API_URL}/api/register`, {
                name: form.name,
                email: form.email,
                password: form.password,
            });

            navigate("/login", {
                state: {
                    message: "Account created successfully. Please sign in.",
                },
            });
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Registration failed. Please try again."
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
                        FIND YOUR SOUND
                    </p>

                    <h1>
                        Your taste.
                        <br />
                        <span>Your collection.</span>
                    </h1>

                    <p className="brand-description">
                        Create your profile, rate songs you love,
                        write reviews, and discover music through
                        the tastes of other listeners.
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
                            GET STARTED
                        </p>

                        <h2>Create your account</h2>

                        <p>
                            Join Tuned and start building your music taste.
                        </p>

                    </div>

                    <form onSubmit={handleSubmit}>

                        {/* Name */}
                        <div className="input-group">

                            <label htmlFor="name">
                                Name
                            </label>

                            <div className="input-wrapper">

                                <User size={19} />

                                <input
                                    id="name"
                                    type="text"
                                    name="name"
                                    placeholder="Your name"
                                    value={form.name}
                                    onChange={handleChange}
                                    autoComplete="name"
                                />

                            </div>

                        </div>

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
                                    name="email"
                                    placeholder="you@example.com"
                                    value={form.email}
                                    onChange={handleChange}
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
                                    name="password"
                                    placeholder="At least 8 characters"
                                    value={form.password}
                                    onChange={handleChange}
                                    autoComplete="new-password"
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

                        {/* Register */}
                        <button
                            type="submit"
                            className="login-button"
                            disabled={loading}
                        >
                            {loading
                                ? "Creating account..."
                                : "Create account"}
                        </button>

                    </form>

                    <div className="register-prompt">

                        <span>
                            Already have an account?
                        </span>

                        <Link to="/login">
                            Sign in
                        </Link>

                    </div>

                </div>

            </section>

        </div>
    );
}

export default Register;