// src/App.jsx – MediRound rebuilt

import React, {
  useState,
  useEffect,
  createContext,
  useContext,
} from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
} from "react-router-dom";

import { Button } from "./components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "./components/ui/card";

import {
  auth,
  db,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
} from "./firebase";

// --------------------------------------------------
// Utilities
// --------------------------------------------------

// Firestore UI shows strings like:
// "November 20, 2025 at 12:55:25 AM UTC-5"
function parseCheckTime(str) {
  if (!str || typeof str !== "string") return null;
  try {
    // Make it something JS Date understands:
    // replace " at " with space & "UTC-5" → "GMT-5"
    const cleaned = str
      .replace(" at ", " ")
      .replace(/UTC([+-]\d+)/, "GMT$1");
    const d = new Date(cleaned);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

// Convert patient.checkIns (object or array) → array of entries
function getCheckInsArray(patient) {
  if (!patient || !patient.checkIns) return [];
  if (Array.isArray(patient.checkIns)) return patient.checkIns;
  return Object.values(patient.checkIns);
}

// Get latest check-in info for a patient
function getLastCheck(patient) {
  const arr = getCheckInsArray(patient);
  if (!arr.length) {
    return { display: "None", date: null, staff: "", isOverdue: true };
  }

  const parsed = arr
    .map((entry) => {
      const date = parseCheckTime(entry.time);
      return date ? { ...entry, date } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.date - a.date);

  if (!parsed.length) {
    return { display: "None", date: null, staff: "", isOverdue: true };
  }

  const latest = parsed[0];
  const minutesSince =
    (Date.now() - latest.date.getTime()) / (1000 * 60);
  const interval = patient.checkInInterval || 0;

  return {
    display: latest.date.toLocaleString(),
    date: latest.date,
    staff: latest.staff || "",
    isOverdue: minutesSince > interval,
  };
}

// Simple overdue check wrapper
function isPatientOverdue(patient) {
  return getLastCheck(patient).isOverdue;
}

// --------------------------------------------------
// Auth + Data Context
// --------------------------------------------------

const DataContext = createContext(null);

function useAppData() {
  return useContext(DataContext);
}

function DataProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setFirebaseUser(user);
        const ref = doc(db, "user", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setProfile(snap.data());
        } else {
          // Fallback profile if doc missing
          setProfile({
            name: user.email,
            email: user.email,
            role: "Staff",
          });
        }
      } else {
        setFirebaseUser(null);
        setProfile(null);
      }
      setLoadingAuth(false);
    });
    return () => unsub();
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
    setFirebaseUser(null);
    setProfile(null);
  };

  const value = {
    firebaseUser,
    profile,
    loadingAuth,
    signOut,
  };

  return (
    <DataContext.Provider value={value}>{children}</DataContext.Provider>
  );
}

// --------------------------------------------------
// Root App
// --------------------------------------------------

export default function App() {
  return (
    <DataProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </DataProvider>
  );
}

function Shell() {
  const { firebaseUser, loadingAuth } = useAppData();

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="p-6">
          <Routes>
            <Route
              path="/"
              element={firebaseUser ? <Dashboard /> : <Login />}
            />
            <Route path="/register" element={<Register />} />
            <Route
              path="/patients"
              element={
                <Protected>
                  <Patients />
                </Protected>
              }
            />
            <Route
              path="/check-ins"
              element={
                <Protected>
                  <Checkins />
                </Protected>
              }
            />
            <Route
              path="/rounding-graph"
              element={
                <Protected>
                  <RoundingGraph />
                </Protected>
              }
            />
            <Route
              path="/reports"
              element={
                <Protected>
                  <Reports />
                </Protected>
              }
            />
            <Route
              path="/users"
              element={
                <Protected>
                  <AdminUsers />
                </Protected>
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}

// --------------------------------------------------
// Layout
// --------------------------------------------------

function Sidebar() {
  const { firebaseUser, profile, signOut } = useAppData();
  const navigate = useNavigate();

  const isAdmin = profile?.role?.toLowerCase() === "admin";

  const links = [
    { to: "/", label: "Dashboard" },
    { to: "/patients", label: "Patients" },
    { to: "/rounding-graph", label: "Rounding Graph" },
    { to: "/reports", label: "Reports" },
  ];
  if (isAdmin) links.push({ to: "/users", label: "Users" });

  return (
    <aside className="w-64 bg-white border-r hidden md:flex flex-col">
      <div className="p-4 text-xl font-bold text-indigo-700 border-b">
        MediRound
      </div>

      <div className="p-4 flex-1">
        {firebaseUser && (
          <div className="mb-4">
            <div className="font-semibold">
              {profile?.name || "User"}
            </div>
            <div className="text-sm text-gray-500">
              {profile?.role || "Staff"}
            </div>
          </div>
        )}

        <nav className="flex flex-col gap-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="px-3 py-2 rounded text-sm hover:bg-gray-100"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>

      {firebaseUser && (
        <div className="p-4 border-t">
          <Button
            variant="ghost"
            className="text-red-600 w-full justify-start"
            onClick={async () => {
              await signOut();
              navigate("/");
            }}
          >
            Sign out
          </Button>
        </div>
      )}
    </aside>
  );
}

function Topbar() {
  const { firebaseUser, profile, signOut } = useAppData();
  const navigate = useNavigate();

  return (
    <header className="bg-white border-b p-3 flex justify-between items-center">
      <div className="text-lg font-semibold text-indigo-700">
        MediRound Dashboard
      </div>
      {firebaseUser && (
        <div className="flex items-center gap-3 text-sm">
          <span>{profile?.email}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await signOut();
              navigate("/");
            }}
          >
            Sign out
          </Button>
        </div>
      )}
    </header>
  );
}

// --------------------------------------------------
// Route Guard
// --------------------------------------------------

function Protected({ children }) {
  const { firebaseUser } = useAppData();
  if (!firebaseUser) {
    return <div className="mt-20 text-center">Please sign in.</div>;
  }
  return children;
}

// --------------------------------------------------
// Auth Screens
// --------------------------------------------------

function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const { firebaseUser } = useAppData();
  const navigate = useNavigate();

  useEffect(() => {
    if (firebaseUser) navigate("/");
  }, [firebaseUser, navigate]);

  async function doLogin() {
    try {
      setBusy(true);
      await signInWithEmailAndPassword(auth, email, pw);
      navigate("/");
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function resetPw() {
    if (!email) return alert("Enter email first.");
    try {
      await sendPasswordResetEmail(auth, email);
      alert("Reset email sent");
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-20">
      <Card>
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="text-sm">Email</label>
          <input
            className="w-full border rounded p-2 mb-3"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="text-sm">Password</label>
          <input
            type="password"
            className="w-full border rounded p-2 mb-4"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />

          <Button className="w-full mb-2" onClick={doLogin}>
            {busy ? "Signing in…" : "Sign In"}
          </Button>

          <button
            type="button"
            onClick={resetPw}
            className="text-xs text-indigo-600"
          >
            Forgot password?
          </button>

          <div className="text-sm mt-4">
            Need an account?{" "}
            <Link to="/register" className="text-indigo-600">
              Register
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function doRegister() {
    try {
      setBusy(true);
      const cred = await createUserWithEmailAndPassword(auth, email, pw);
      await setDoc(doc(db, "user", cred.user.uid), {
        name,
        email,
        role: "Staff", // default role
      });
      alert("Account created.");
      navigate("/");
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-20">
      <Card>
        <CardHeader>
          <CardTitle>Register</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="text-sm">Name</label>
          <input
            className="w-full border rounded p-2 mb-3"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label className="text-sm">Email</label>
          <input
            className="w-full border rounded p-2 mb-3"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="text-sm">Password</label>
          <input
            type="password"
            className="w-full border rounded p-2 mb-4"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />

          <Button className="w-full" onClick={doRegister}>
            {busy ? "Working…" : "Register"}
          </Button>

          <div className="text-sm mt-4">
            Already have an account?{" "}
            <Link to="/" className="text-indigo-600">
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --------------------------------------------------
// Dashboard
// --------------------------------------------------

function Dashboard() {
  const [patients, setPatients] = useState([]);

  useEffect(() => {
    async function load() {
      const snaps = await getDocs(collection(db, "patients"));
      setPatients(snaps.docs.map((d) => ({ id: d.id, ...d.data() })));
    }
    load();
  }, []);

  const total = patients.length;
  const overdue = patients.filter(isPatientOverdue).length;
  const onTime = total - overdue;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Card className="p-4">
          <div className="text-xs text-gray-500">Total patients</div>
          <div className="text-2xl font-bold">{total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-gray-500">Overdue checks</div>
          <div className="text-2xl font-bold text-red-600">
            {overdue}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-gray-500">On-time / OK</div>
          <div className="text-2xl font-bold text-green-600">
            {onTime}
          </div>
        </Card>
      </div>
    </div>
  );
}

// --------------------------------------------------
// Patients
// --------------------------------------------------

function Patients() {
  const [patients, setPatients] = useState([]);

  useEffect(() => {
    async function load() {
      const snaps = await getDocs(collection(db, "patients"));
      setPatients(snaps.docs.map((d) => ({ id: d.id, ...d.data() })));
    }
    load();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Patients</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {patients.map((p) => {
          const last = getLastCheck(p);
          return (
            <Card
              key={p.id}
              className="p-4 flex flex-col justify-between"
            >
              <div>
                <div className="text-lg font-semibold">{p.name}</div>
                <div className="text-sm text-gray-600">
                  {p.location}
                </div>
                <div className="text-sm text-gray-600">
                  Wristband: {p.wristbandID}
                </div>
                <div className="text-sm text-gray-600">
                  Interval: {p.checkInInterval} min
                </div>
                <div className="text-sm text-gray-600">
                  Comments: {p.comments}
                </div>
                <div className="text-sm text-gray-600">
                  Last check: {last.display}
                </div>
              </div>
              <div className="text-right mt-2">
                <span
                  className={
                    "font-semibold " +
                    (last.isOverdue ? "text-red-500" : "text-green-600")
                  }
                >
                  {last.isOverdue ? "Overdue" : "On-time"}
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------
// Check-ins list
// --------------------------------------------------

function Checkins() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    async function load() {
      const snaps = await getDocs(collection(db, "patients"));
      const pts = snaps.docs.map((d) => ({ id: d.id, ...d.data() }));

      const list = [];
      pts.forEach((p) => {
        const ciArr = getCheckInsArray(p);
        ciArr.forEach((ci) => {
          const date = parseCheckTime(ci.time);
          if (!date) return;
          list.push({
            patient: p.name,
            staff: ci.staff || "",
            timeStr: ci.time,
            date,
          });
        });
      });

      list.sort((a, b) => b.date - a.date);
      setRows(list);
    }
    load();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Check-ins</h1>
      <Card className="p-4 max-h-[500px] overflow-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="text-left px-2 py-1">Patient</th>
              <th className="text-left px-2 py-1">Time</th>
              <th className="text-left px-2 py-1">Staff</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b">
                <td className="px-2 py-1">{r.patient}</td>
                <td className="px-2 py-1">{r.timeStr}</td>
                <td className="px-2 py-1">{r.staff}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// --------------------------------------------------
// Rounding Graph
// --------------------------------------------------

function RoundingGraph() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  // build 24 hourly slots ending at current hour
  const now = new Date();
  const slots = [];
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 3600000);
    d.setMinutes(0, 0, 0);
    slots.push(d);
  }

  useEffect(() => {
    async function load() {
      const snaps = await getDocs(collection(db, "patients"));
      setPatients(snaps.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }
    load();
  }, []);

  function hasCheckInInSlot(patient, slot) {
    const start = slot.getTime();
    const end = start + 3600000;

    return getCheckInsArray(patient).some((ci) => {
      const d = parseCheckTime(ci.time);
      if (!d) return false;
      const t = d.getTime();
      return t >= start && t < end;
    });
  }

  if (loading) {
    return <div>Loading…</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Rounding Graph</h1>
      <Card className="p-4 overflow-auto">
        <table className="text-xs min-w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white px-2 py-1 text-left border-b">
                Patient
              </th>
              {slots.map((s, i) => (
                <th
                  key={i}
                  className="px-2 py-1 text-center border-b"
                >
                  {s.getHours()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => (
              <tr key={p.id}>
                <td className="sticky left-0 bg-white px-2 py-1 border-b">
                  {p.name}
                </td>
                {slots.map((slot, i) => {
                  const has = hasCheckInInSlot(p, slot);
                  return (
                    <td
                      key={i}
                      className="px-2 py-2 border-b text-center"
                    >
                      <div
                        className={
                          "w-3 h-3 mx-auto rounded-full " +
                          (has ? "bg-blue-600" : "bg-red-300")
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// --------------------------------------------------
// Reports (CSV)
// --------------------------------------------------

function Reports() {
  const [patients, setPatients] = useState([]);

  useEffect(() => {
    async function load() {
      const snaps = await getDocs(collection(db, "patients"));
      setPatients(snaps.docs.map((d) => ({ id: d.id, ...d.data() })));
    }
    load();
  }, []);

  function exportCSV() {
    const rows = [
      ["Patient", "Location", "Interval", "Last Check", "Last Staff"],
    ];

    patients.forEach((p) => {
      const last = getLastCheck(p);
      rows.push([
        p.name,
        p.location,
        p.checkInInterval,
        last.display,
        last.staff,
      ]);
    });

    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mediround-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Reports</h1>
      <Card className="p-4">
        <Button onClick={exportCSV}>Download CSV</Button>
      </Card>
    </div>
  );
}

// --------------------------------------------------
// Users (Admin / Manager)
// --------------------------------------------------

function AdminUsers() {
  const { profile } = useAppData();
  const isAdmin = profile?.role?.toLowerCase() === "admin";
  const isManager = profile?.role?.toLowerCase() === "manager";
  const canReset = isAdmin || isManager;
  const canChangeRole = isAdmin;

  const [users, setUsers] = useState([]);

  useEffect(() => {
    async function load() {
      const snaps = await getDocs(collection(db, "user"));
      setUsers(snaps.docs.map((d) => ({ id: d.id, ...d.data() })));
    }
    load();
  }, []);

  if (!isAdmin && !isManager) {
    return <div>Admins or Managers only.</div>;
  }

  async function changeRole(uid, newRole) {
    await setDoc(doc(db, "user", uid), { role: newRole }, { merge: true });
    setUsers((prev) =>
      prev.map((u) => (u.id === uid ? { ...u, role: newRole } : u))
    );
  }

  async function resetPassword(email) {
    try {
      await sendPasswordResetEmail(auth, email);
      alert("Password reset email sent");
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Users</h1>
      <Card className="p-4">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left px-2 py-1">Name</th>
              <th className="text-left px-2 py-1">Email</th>
              <th className="text-left px-2 py-1">Role</th>
              <th className="text-left px-2 py-1">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b">
                <td className="px-2 py-1">{u.name}</td>
                <td className="px-2 py-1">{u.email}</td>
                <td className="px-2 py-1">{u.role}</td>
                <td className="px-2 py-1">
                  {canChangeRole && (
                    <select
                      className="border rounded p-1 mr-2"
                      value={u.role}
                      onChange={(e) => changeRole(u.id, e.target.value)}
                    >
                      <option value="Staff">Staff</option>
                      <option value="Manager">Manager</option>
                      <option value="Admin">Admin</option>
                    </select>
                  )}
                  {canReset && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resetPassword(u.email)}
                    >
                      Reset password
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
