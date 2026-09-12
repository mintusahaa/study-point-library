/* =========================================================
   STUDY POINT LIBRARY
   Supabase-connected frontend
   File: js/app.js
   ========================================================= */

const { createClient } = window.supabase;

const supabaseClient = createClient(
  SPL_CONFIG.SUPABASE_URL,
  SPL_CONFIG.SUPABASE_KEY
);


/* =========================================================
   BASIC HELPERS
   ========================================================= */

const $ = (id) => document.getElementById(id);

function showModal(html) {
  $("modalContent").innerHTML = html;
  $("modal").classList.remove("hidden");
}

function closeModal() {
  $("modal").classList.add("hidden");
}

window.closeModal = closeModal;

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* =========================================================
   SEATS
   ========================================================= */

let allSeats = [];

async function loadSeats() {

  const { data, error } = await supabaseClient
    .from("seats")
    .select("*")
    .order("hall")
    .order("seat_number");

  if (error) {
    console.error("Seat loading error:", error);
    $("seatMap").innerHTML = `
      <div class="info-card">
        <h3>Unable to load live seats</h3>
        <p>Please check your Supabase connection and database permissions.</p>
      </div>
    `;
    return;
  }

  allSeats = data || [];

  renderSeats();
  updateSeatCounters();
}


function renderSeats() {

  const seatMap = $("seatMap");

  if (!allSeats.length) {
    seatMap.innerHTML = `
      <div class="info-card">
        <h3>No seats found</h3>
        <p>Please check the seats table in Supabase.</p>
      </div>
    `;
    return;
  }

  const halls = {};

  allSeats.forEach(seat => {

    const hallName = seat.hall || "Library";

    if (!halls[hallName]) {
      halls[hallName] = [];
    }

    halls[hallName].push(seat);
  });


  seatMap.innerHTML = Object.entries(halls)
    .map(([hall, seats]) => {

      return `
        <div class="seat-hall">

          <div class="section-head">
            <div>
              <span class="eyebrow">${escapeHTML(hall)}</span>
              <h3>Seat Map</h3>
            </div>
          </div>

          <div class="seat-grid">

            ${seats.map(seat => {

              const status = seat.status || "available";

              let symbol = "🟢";

              if (status === "occupied") {
                symbol = "🔴";
              }

              if (status === "reserved") {
                symbol = "🟡";
              }

              return `
                <button
                  class="seat ${escapeHTML(status)}"
                  onclick="selectSeat('${escapeHTML(seat.id)}')"
                  ${status !== "available" ? "disabled" : ""}
                >
                  <span>${symbol}</span>
                  <b>${escapeHTML(seat.seat_number)}</b>
                </button>
              `;

            }).join("")}

          </div>

        </div>
      `;

    }).join("");
}


function updateSeatCounters() {

  const total = allSeats.length;

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

  const totalElements = document.querySelectorAll(
    ".mini-stats div:first-child b"
  );

  totalElements.forEach(el => {
    el.textContent = total;
  });
}


window.selectSeat = function (seatId) {

  const seat = allSeats.find(
    item => String(item.id) === String(seatId)
  );

  if (!seat) return;

  if (seat.status !== "available") {
    return;
  }

  showModal(`
    <h2>Seat ${escapeHTML(seat.seat_number)}</h2>

    <p>
      ${escapeHTML(seat.hall || "Study Point Library")}
    </p>

    <p>
      This seat is currently available.
    </p>

    <button
      class="btn btn-primary full"
      onclick="openLogin()"
    >
      Login to Book This Seat
    </button>
  `);
};


/* =========================================================
   STUDENT AUTH
   ========================================================= */

let currentUser = null;
let currentProfile = null;


async function loadCurrentUser() {

  const {
    data: { user }
  } = await supabaseClient.auth.getUser();

  currentUser = user || null;

  if (currentUser) {
    await loadProfile();
  } else {
    updateStudentDashboard();
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
    console.error("Profile error:", error);
    return;
  }

  currentProfile = data;

  updateStudentDashboard();

  await loadMembership();
  await loadAttendance();
}


function updateStudentDashboard() {

  if (!currentUser) {

    $("studentName").textContent = "Student";
    $("studentId").textContent = "ID: —";
    $("studentSeat").textContent = "—";
    $("studentPlan").textContent = "—";
    $("studentValidity").textContent = "—";
    $("paymentStatus").textContent = "—";
    $("liveBadge").textContent = "Logged out";
    $("checkBtn").textContent = "Login to Check In";

    return;
  }

  const name =
    currentProfile?.full_name ||
    currentProfile?.name ||
    currentUser.email ||
    "Student";

  const studentId =
    currentProfile?.student_id ||
    currentProfile?.id ||
    currentUser.id;

  $("studentName").textContent = name;
  $("studentId").textContent = `ID: ${studentId}`;

  $("liveBadge").textContent = "Logged in";
  $("checkBtn").textContent = "Check In / Check Out";
}


async function openLogin() {

  showModal(`
    <h2>Student Login</h2>

    <p>Login to access your Study Point Library account.</p>

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

      <button class="btn btn-primary full" type="submit">
        Login
      </button>

    </form>

    <br>

    <button
      class="btn btn-outline full"
      onclick="openSignup()"
    >
      Create Student Account
    </button>

    <p id="authMessage"></p>
  `);

  $("loginForm").addEventListener("submit", loginStudent);
}


window.openLogin = openLogin;


async function loginStudent(event) {

  event.preventDefault();

  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  $("authMessage").textContent = "Logging in...";

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    $("authMessage").textContent = error.message;
    return;
  }

  closeModal();

  await loadCurrentUser();
}


async function openSignup() {

  showModal(`
    <h2>Create Student Account</h2>

    <p>Enter your details to create your library account.</p>

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

      <button class="btn btn-primary full" type="submit">
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

  $("signupForm").addEventListener("submit", signupStudent);
}


async function signupStudent(event) {

  event.preventDefault();

  const name = $("signupName").value.trim();
  const studentId = $("signupStudentId").value.trim();
  const email = $("signupEmail").value.trim();
  const password = $("signupPassword").value;

  $("authMessage").textContent = "Creating account...";

  const {
    data,
    error
  } = await supabaseClient.auth.signUp({
    email,
    password
  });

  if (error) {
    $("authMessage").textContent = error.message;
    return;
  }

  if (!data.user) {
    $("authMessage").textContent =
      "Account could not be created.";
    return;
  }

  const { error: profileError } = await supabaseClient
    .from("profiles")
    .insert({
      id: data.user.id,
      full_name: name,
      student_id: studentId,
      role: "student"
    });

  if (profileError) {

    console.error(profileError);

    $("authMessage").textContent =
      "Account created, but profile setup needs attention.";

    return;
  }

  $("authMessage").textContent =
    "Account created successfully. Please login.";

  setTimeout(openLogin, 1000);
}


/* =========================================================
   MEMBERSHIP
   ========================================================= */

async function loadMembership() {

  if (!currentUser) return;

  const { data, error } = await supabaseClient
    .from("memberships")
    .select("*")
    .eq("student_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Membership error:", error);
    return;
  }

  if (!data) return;

  $("studentPlan").textContent =
    data.plan_type || "—";

  $("studentValidity").textContent =
    data.end_date || data.valid_until || "—";

  $("paymentStatus").textContent =
    data.payment_status || "—";

  if (data.seat_id) {

    const seat = allSeats.find(
      s => String(s.id) === String(data.seat_id)
    );

    if (seat) {
      $("studentSeat").textContent =
        seat.seat_number;
    }
  }
}


/* =========================================================
   ATTENDANCE
   ========================================================= */

async function loadAttendance() {

  if (!currentUser) return;

  const { data, error } = await supabaseClient
    .from("attendance")
    .select("*")
    .eq("student_id", currentUser.id)
    .order("check_in", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Attendance error:", error);
    return;
  }

  let totalMinutes = 0;

  (data || []).forEach(record => {

    if (!record.check_in) return;

    const start = new Date(record.check_in);

    const end = record.check_out
      ? new Date(record.check_out)
      : new Date();

    const minutes =
      Math.max(0, end - start) / 60000;

    totalMinutes += minutes;
  });

  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);

  $("studyTime").textContent =
    `${hours}h ${minutes}m`;
}


/* =========================================================
   CHECK IN / CHECK OUT
   ========================================================= */

async function handleCheckButton() {

  if (!currentUser) {
    openLogin();
    return;
  }

  const { data, error } = await supabaseClient
    .from("attendance")
    .select("*")
    .eq("student_id", currentUser.id)
    .is("check_out", null)
    .maybeSingle();

  if (error) {
    console.error(error);
    return;
  }

  if (data) {
    await checkoutStudent(data);
  } else {
    await checkinStudent();
  }
}


async function checkinStudent() {

  if (!currentUser) {
    openLogin();
    return;
  }

  const { error } = await supabaseClient
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

  const { error } = await supabaseClient
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


/* =========================================================
   NOTICES
   ========================================================= */

async function loadNotices() {

  const { data, error } = await supabaseClient
    .from("notices")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Notice error:", error);
    return;
  }

  const noticeList = $("noticeList");

  if (!data || !data.length) {

    noticeList.innerHTML = `
      <div class="info-card">
        <h3>No notices</h3>
        <p>There are currently no library notices.</p>
      </div>
    `;

    return;
  }

  noticeList.innerHTML = data.map(notice => `
    <article class="notice-card">

      <h3>
        ${escapeHTML(notice.title || "Library Notice")}
      </h3>

      <p>
        ${escapeHTML(notice.content || notice.message || "")}
      </p>

    </article>
  `).join("");
}


/* =========================================================
   QR
   ========================================================= */

function openQR() {

  showModal(`
    <h2>Study Point Library QR</h2>

    <p>
      Scan the permanent QR at the library entrance
      to check IN or CHECK OUT.
    </p>

    <div class="qr-placeholder">
      QR
    </div>

    <p>
      The final QR will be connected to the
      student attendance system.
    </p>
  `);
}


/* =========================================================
   MEMBERSHIP PLAN
   ========================================================= */

window.selectPlan = function(plan) {

  showModal(`
    <h2>${escapeHTML(plan)}</h2>

    <p>
      You selected:
      <strong>${escapeHTML(plan)}</strong>
    </p>

    <p>
      Login to your student account to continue
      with seat selection and membership.
    </p>

    <button
      class="btn btn-primary full"
      onclick="openLogin()"
    >
      Student Login
    </button>
  `);
};


/* =========================================================
   SUPABASE REALTIME
   ========================================================= */

function startRealtime() {

  supabaseClient
    .channel("library-live-updates")

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


/* =========================================================
   AUTH STATE
   ========================================================= */

supabaseClient.auth.onAuthStateChange(
  async (event, session) => {

    currentUser = session?.user || null;

    if (currentUser) {
      await loadProfile();
    } else {
      currentProfile = null;
      updateStudentDashboard();
    }
  }
);


/* =========================================================
   BUTTONS
   ========================================================= */

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


/* =========================================================
   YEAR
   ========================================================= */

if ($("year")) {
  $("year").textContent =
    new Date().getFullYear();
}


/* =========================================================
   START APPLICATION
   ========================================================= */

async function startApp() {

  console.log("Study Point Library starting...");

  await loadSeats();

  await loadNotices();

  await loadCurrentUser();

  startRealtime();

  console.log(
    "Study Point Library connected."
  );
}

startApp();
