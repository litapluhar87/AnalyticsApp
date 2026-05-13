const PLAYERS = [
  "Ajinath", "Amar", "Amol", "Andy", "Anil", "Avinash",
  "Eshwar", "Gaurav", "Macchi", "Mangesh", "Mithun", "Neeraj",
  "Onkar", "Rahul", "Ranjit", "Ravindra", "Sandy D", "Sandy N",
  "Sarang", "Shashi", "Sudhir", "Sushil", "Tushar", "Vallabh"
];

function LoginPage() {
  const [selectedPlayer, setSelectedPlayer] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");

  const handleLogin = () => {
    if (!selectedPlayer) {
      setError("Please select your profile");
      return;
    }

    if (password !== "racl") {
      setError("Invalid password");
      return;
    }

    setError("");
    alert(`Welcome ${selectedPlayer}!`);

    // Example:
    // localStorage.setItem("loggedInPlayer", selectedPlayer);
    // navigate to app/home page
  };

  return (
    <div style={styles.page}>
      
      {/* Sticky Header */}
      <div style={styles.header}>
        Login
      </div>

      {/* Login Card */}
      <div style={styles.card}>
        
        <div style={styles.label}>Select your profile</div>

        <select
          value={selectedPlayer}
          onChange={(e) => setSelectedPlayer(e.target.value)}
          style={styles.select}
        >
          <option value="">-- Select Player --</option>

          {PLAYERS.map((player) => (
            <option key={player} value={player}>
              {player}
            </option>
          ))}
        </select>

        <div style={{ ...styles.label, marginTop: 18 }}>
          Password
        </div>

        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
        />

        {error && (
          <div style={styles.error}>
            {error}
          </div>
        )}

        <button onClick={handleLogin} style={styles.button}>
          Login
        </button>

      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f4f6f9",
    fontFamily: "Arial, sans-serif",
  },

  header: {
    position: "sticky",
    top: 0,
    zIndex: 1000,
    background: "#0b3d91",
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
    padding: "16px 20px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  },

  card: {
    maxWidth: 420,
    margin: "40px auto",
    background: "white",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 4px 18px rgba(0,0,0,0.08)",
  },

  label: {
    fontSize: 15,
    fontWeight: 600,
    marginBottom: 8,
    color: "#333",
  },

  select: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #ccc",
    fontSize: 15,
    outline: "none",
  },

  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #ccc",
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
  },

  button: {
    width: "100%",
    marginTop: 24,
    background: "#0b3d91",
    color: "white",
    border: "none",
    padding: "14px",
    borderRadius: 12,
    fontSize: 16,
    fontWeight: "bold",
    cursor: "pointer",
  },

  error: {
    color: "#d32f2f",
    marginTop: 12,
    fontSize: 14,
    fontWeight: 500,
  },
};

export default LoginPage;