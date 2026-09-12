/* =========================================================
   STUDY POINT LIBRARY
   Supabase Frontend
   ========================================================= */

const { createClient } = window.supabase;

const supabaseClient = createClient(
  SPL_CONFIG.SUPABASE_URL,
  SPL_CONFIG.SUPABASE_KEY
);

let currentUser = null;
let currentProfile = null;
let allSeats = [];


/* ================= HELPERS ================= */

const $ = (id) => document.getElementById(id);

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showModal(html) {
  $("modalContent").innerHTML = html;
  $("modal").classList.remove("hidden");
}

function closeModal() {
  $("modal").classList.add("hidden");
}

window.closeModal = closeModal;


/* ================= SEATS ================= */

async function loadSeats() {

  const { data, error } = await supabaseClient
    .from("seats")
    .select("*")
    .order("hall")
    .order("seat_number");

  if (error) {
    console.error(error);

    $("seatMap").innerHTML = `
      <div class="info-card">
        <h3>Unable to load seats</h3>
        <p>${escapeHTML(error.message)}</p>
      </div>
    `;

    return;
  }

  allSeats = data || [];

  renderSeats();
  updateSeatCounters();
}


function renderSeats() {

  const map = $("seatMap");

  if (!allSeats.length) {
    map.innerHTML = `
      <div class="info-card">
        <h3>No seats found</h3>
        <p>Please check your Supabase seats table.</p>
      </div>
    `;
    return;
  }

  const hall1 = allSeats.filter(
    seat => seat.hall === "Hall 1"
  );

  const hall2 = allSeats.filter(
    seat => seat.hall === "Hall 2"
  );

  map.innerHTML = `
    ${renderHall("Hall 1", hall1)}
    ${renderHall("Hall 2", hall2)}
  `;
}


function renderHall(name, seats) {

  return `
    <div class="seat-hall">

      <div class="section-head">
        <div>
          <span class="eyebrow">${name}</span>
          <h3>Seat Map</h3>
        </div>
      </div>

      <div class="seat-grid">

        ${seats.map(seat => {

          const status = seat.status || "available";

          const icon =
            status === "occupied" ? "🔴" :
            status === "reserved" ? "🟡" :
            "🟢";

          return `
            <button
              class="seat ${escapeHTML(status)}"
              onclick="selectSeat('${seat.id}')"
              ${status !== "available" ? "disabled" : ""}
            >
              <span>${icon}</span>
              <b>${escapeHTML(seat.seat_number)}</b>
            </button>
          `;

        }).join("")}

      </div>
    </div>
  `;
}


function updateSeatCounters() {

  const available = allSeats.filter(
    seat => seat.status === "available"
  ).length;

  const occupied = allSeats.filter(
    seat => seat.status === "occupied"
  ).length;

  if ($("availableCount")) {
    $("availableCount").textContent = available;
  }

  if ($("insideCount")) {
    $("insideCount").textContent = occupied;
  }

  document.querySelectorAll(
    ".mini-stats div:first-child b"
  ).forEach(el => {
    el.textContent = allSeats.length;
  });
}


window.selectSeat = function(seatId) {

  const seat = allSeats.find(
    s => String(s.id) === String(seatId)
  );

  if (!seat) return;

  if (seat.status !== "available") {
    return;
  }

  if (!currentUser) {

    showModal(`
      <h2>Seat ${escapeHTML(seat.seat_number)}</h2>

      <p>
        This seat is available.
      </p>

      <button
        class="btn btn-primary full"
        onclick="openLogin()"
      >
        Login to Continue
      </button>
    `);

    return;
  }

  showModal(`
    <h2>Seat ${escapeHTML(seat.seat_number)}</h2>

    <p>
      Hall: ${escapeHTML(seat.hall)}
    </p>

    <p>
      Seat is currently available.
    </p>

    <button
      class="btn btn-primary full"
      onclick="requestSeat('${seat.id}')"
    >
      Select This Seat
    </button>
  `);
};


window.requestSeat = function(seatId) {

  showModal(`
    <h2>Seat Selection</h2>

    <p>
      Your seat selection system will be connected
      to the membership/booking system next.
    </p>

    <button
      class="btn btn-outline full"
      onclick="closeModal()"
    >
      Close
    </button>
  `);
};


/* ================= AUTH ================= */

async function loadCurrentUser() {

  const {
    data: { user }
  } = await supabaseClient.auth.getUser();

  currentUser = user || null;

  if (currentUser) {
    await loadProfile();
  } else {
    updateDashboard();
  }
}


async function loadProfile() {

  if (!currentUser) return;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("Profile:", error);
    return;
  }

  currentProfile = data || null;

  updateDashboard();

  await loadMembership();
  await loadAttendance();
}


function updateDashboard() {

  if (!currentUser) {

    $("studentName").textContent = "Student";
    $("studentId").textContent = "ID: —";
    $("studentSeat").textContent = "—";
    $("studentPlan").textContent = "—";
    $("studentValidity").textContent = "—";
    $("paymentStatus").textContent = "—";
    $("studyTime").textContent = "0h 0m";
    $("liveBadge").textContent = "Logged out";
    $("checkBtn").textContent = "Login to Check In";

    return;
  }

  $("studentName").textContent =
    currentProfile?.full_name ||
    currentUser.email ||
    "Student";

  $("studentId").textContent =
    `ID: ${currentProfile?.student_id || "—"}`;

  $("liveBadge").textContent = "Logged in";
  $("checkBtn").textContent = "Check In / Check Out";
}


/* ================= LOGIN ================= */

async function openLogin() {

  showModal(`
    <h2>Student Login</h2>

    <form id="loginForm">

      <input
        id="loginEmail"
        type="email"
        placeholder="Email address"
        required
      >

      <input
        id="loginPassword"
        type="password"
        placeholder="Password"
        required
      >

      <button
        class="btn btn-primary full"
        type="submit"
      >
        Login
      </button>

    </form>

    <p id="authMessage"></p>

    <button
      class="btn btn-outline full"
      onclick="openSignup()"
    >
      Create Account
    </button>
  `);

  $("loginForm").addEventListener(
    "submit",
    loginStudent
  );
}

window.openLogin = openLogin;


async function loginStudent(event) {

  event.preventDefault();

  const email =
    $("loginEmail").value.trim();

  const password =
    $("loginPassword").value;

  $("authMessage").textContent =
    "Logging in...";

  const { error } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

  if (error) {

    $("authMessage").textContent =
      error.message;

    return;
  }

  closeModal();

  await loadCurrentUser();
}


/* ================= SIGNUP ================= */

async function openSignup() {

  showModal(`
    <h2>Create Student Account</h2>

    <form id="signupForm">

      <input
        id="signupName"
        type="text"
        placeholder="Full name"
        required
      >

      <input
        id="signupStudentId"
        type="text"
        placeholder="Student ID"
        required
      >

      <input
        id="signupEmail"
        type="email"
        placeholder="Email address"
        required
      >

      <input
        id="signupPassword"
        type="password"
        placeholder="Password"
        minlength="6"
        required
      >

      <button
        class="btn btn-primary full"
        type="submit"
      >
        Create Account
      </button>

    </form>

    <p id="authMessage"></p>

    <button
      class="btn btn-outline full"
      onclick="openLogin()"
    >
      Back to Login
    </button>
  `);

  $("signupForm").addEventListener(
    "submit",
    signupStudent
  );
}

window.openSignup = openSignup;


async function signupStudent(event) {

  event.preventDefault();

  const name =
    $("signupName").value.trim();

  const studentId =
    $("signupStudentId").value.trim();

  const email =
    $("signupEmail").value.trim();

  const password =
    $("signupPassword").value;

  $("authMessage").textContent =
    "Creating account...";

  const { data, error } =
    await supabaseClient.auth.signUp({
      email,
      password
    });

  if (error) {

    $("authMessage").textContent =
      error.message;

    return;
  }

  if (!data.user) {

    $("authMessage").textContent =
      "Account could not be created.";

    return;
  }

  const { error: profileError } =
    await supabaseClient
      .from("profiles")
      .insert({
        id: data.user.id,
        student_id: studentId,
        full_name: name,
        role: "student"
      });

  if (profileError) {

    console.error(profileError);

    $("authMessage").textContent =
      "Auth account created, but profile creation failed.";

    return;
  }

  $("authMessage").textContent =
    "Account created successfully.";

  setTimeout(() => {
    openLogin();
  }, 1000);
}


/* ================= MEMBERSHIP ================= */

async function loadMembership() {

  if (!currentUser) return;

  const { data, error } =
    await supabaseClient
      .from("memberships")
      .select("*")
      .eq("student_id", currentUser.id)
      .order("created_at", {
        ascending: false
      })
      .limit(1)
      .maybeSingle();

  if (error) {

    console.error("Membership:", error);
    return;
  }

  if (!data) return;

  $("studentPlan").textContent =
    data.plan || "—";

  $("studentValidity").textContent =
    data.end_date || "—";

  $("paymentStatus").textContent =
    data.payment_status || "—";
}


/* ================= ATTENDANCE ================= */

async function loadAttendance() {

  if (!currentUser) return;

  const { data, error } =
    await supabaseClient
      .from("attendance")
      .select("*")
      .eq("student_id", currentUser.id)
      .order("check_in", {
        ascending: false
      })
      .limit(100);

  if (error) {

    console.error("Attendance:", error);
    return;
  }

  let totalSeconds = 0;

  (data || []).forEach(record => {

    if (!record.check_in) return;

    if (record.duration_seconds) {

      totalSeconds +=
        Number(record.duration_seconds);

      return;
    }

    if (!record.check_out) return;

    const start =
      new Date(record.check_in);

    const end =
      new Date(record.check_out);

    totalSeconds +=
      Math.max(
        0,
        (end - start) / 1000
      );
  });

  const hours =
    Math.floor(totalSeconds / 3600);

  const minutes =
    Math.floor(
      (totalSeconds % 3600) / 60
    );

  $("studyTime").textContent =
    `${hours}h ${minutes}m`;
}


/* ================= CHECK IN / OUT ================= */

async function handleCheckButton() {

  if (!currentUser) {

    openLogin();
    return;
  }

  const { data, error } =
    await supabaseClient
      .from("attendance")
      .select("*")
      .eq("student_id", currentUser.id)
      .is("check_out", null)
      .maybeSingle();

  if (error) {

    showModal(`
      <h2>Attendance Error</h2>
      <p>${escapeHTML(error.message)}</p>
    `);

    return;
  }

  if (data) {

    await checkoutStudent(data);

  } else {

    await checkinStudent();
  }
}


async function checkinStudent() {

  const { error } =
    await supabaseClient
      .from("attendance")
      .insert({
        student_id: currentUser.id,
        check_in: new Date().toISOString()
      });

  if (error) {

    showModal(`
      <h2>Check-in failed</h2>
      <p>${escapeHTML(error.message)}</p>
    `);

    return;
  }

  showModal(`
    <h2>✅ Checked In</h2>
    <p>Your study session has started.</p>
  `);

  await loadAttendance();
}


async function checkoutStudent(record) {

  const { error } =
    await supabaseClient
      .from("attendance")
      .update({
        check_out: new Date().toISOString()
      })
      .eq("id", record.id);

  if (error) {

    showModal(`
      <h2>Check-out failed</h2>
      <p>${escapeHTML(error.message)}</p>
    `);

    return;
  }

  showModal(`
    <h2>✅ Checked Out</h2>
    <p>Your study session has been recorded.</p>
  `);

  await loadAttendance();
}


/* ================= NOTICES ================= */

async function loadNotices() {

  const { data, error } =
    await supabaseClient
      .from("notices")
      .select("*")
      .eq("published", true)
      .order("created_at", {
        ascending: false
      })
      .limit(10);

  if (error) {

    console.error("Notices:", error);
    return;
  }

  if (!data || !data.length) {

    $("noticeList").innerHTML = `
      <div class="info-card">
        <h3>No notices</h3>
        <p>No library notices have been published.</p>
      </div>
    `;

    return;
  }

  $("noticeList").innerHTML =
    data.map(notice => `
      <article class="notice-card">

        <h3>
          ${escapeHTML(notice.title)}
        </h3>

        <p>
          ${escapeHTML(notice.body)}
        </p>

      </article>
    `).join("");
}


/* ================= QR ================= */

function openQR() {

  showModal(`
    <h2>Study Point Library QR</h2>

    <p>
      Use the permanent QR at the library entrance
      for attendance.
    </p>

    <div class="qr-placeholder">
      QR
    </div>

    <p>
      The final QR check-in/out flow will be connected
      after the attendance security functions are added.
    </p>
  `);
}


/* ================= PLANS ================= */

window.selectPlan = function(plan) {

  showModal(`
    <h2>${escapeHTML(plan)}</h2>

    <p>
      You selected
      <strong>${escapeHTML(plan)}</strong>.
    </p>

    <button
      class="btn btn-primary full"
      onclick="openLogin()"
    >
      Student Login
    </button>
  `);
};


/* ================= REALTIME ================= */

function startRealtime() {

  supabaseClient
    .channel("study-point-live")

    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "seats"
      },
      () => {
        loadSeats();
      }
    )

    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "attendance"
      },
      () => {
        loadSeats();

        if (currentUser) {
          loadAttendance();
        }
      }
    )

    .subscribe();
}


/* ================= AUTH STATE ================= */

supabaseClient.auth.onAuthStateChange(
  async (_event, session) => {

    currentUser =
      session?.user || null;

    if (currentUser) {
      await loadProfile();
    } else {
      currentProfile = null;
      updateDashboard();
    }
  }
);


/* ================= BUTTONS ================= */

$("loginBtn")?.addEventListener(
  "click",
  openLogin
);

$("checkBtn")?.addEventListener(
  "click",
  handleCheckButton
);

$("qrBtn")?.addEventListener(
  "click",
  openQR
);

$("qrBtn2")?.addEventListener(
  "click",
  openQR
);


/* ================= YEAR ================= */

if ($("year")) {
  $("year").textContent =
    new Date().getFullYear();
}


/* ================= START ================= */

async function startApp() {

  console.log(
    "Study Point Library starting..."
  );

  await loadSeats();

  await loadNotices();

  await loadCurrentUser();

  startRealtime();

  console.log(
    "Study Point Library connected to Supabase."
  );
}

startApp();
