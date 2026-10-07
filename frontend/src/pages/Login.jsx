// Placeholder login form. It doesn't authenticate yet; that needs FastAPI.
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: POST to /api/auth/login, store the token, then navigate.
    // Never store passwords in the browser.
    navigate("/");
  };

  return (
    <div className="login">
      <form className="login__form" onSubmit={handleSubmit}>
        <h1>LPBD Validation</h1>
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                 autoComplete="current-password" required />
        </label>
        <button type="submit">Sign in</button>
        <p className="muted small">Login isn't connected yet.</p>
      </form>
    </div>
  );
}