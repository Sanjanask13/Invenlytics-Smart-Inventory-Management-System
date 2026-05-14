import React from "react";
/*
function Home() {
  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h1>Invenlytics</h1>

      <button onClick={() => window.location.href="/login"}>
        Merchant Login
      </button>

      <br /><br />

      <button onClick={() => window.location.href="/register"}>
        Merchant Signup
      </button>

      <br /><br />

      <button onClick={() => window.location.href="/admin"}>
        Admin Login
      </button>
    </div>
  );
}

export default Home;

*/

function Home() {
  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h1>Invenlytics</h1>

      <div style={{ marginTop: "30px" }}>
        <button onClick={() => window.location.href="/login"}>
          Merchant Login
        </button>

        <button onClick={() => window.location.href="/register"}>
          Signup
        </button>

        <button onClick={() => window.location.href="/admin-login"}>
          Admin Login
        </button>
      </div>
    </div>
  );
}

export default Home;