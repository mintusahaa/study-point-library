/* =========================================================
   STUDY POINT LIBRARY
   Supabase Frontend - Complete Version
   ========================================================= */

const { createClient } = window.supabase;

const supabaseClient = createClient(
  SPL_CONFIG.SUPABASE_URL,
  SPL_CONFIG.SUPABASE_KEY
);

let currentUser = null;
let currentProfile = null;
let allSeats = [];


/* =========================================================
   HELPERS
   ========================================================= */

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

  if (!$("modal") || !$("modalContent")) {
    alert(
      String(html)
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
    );

    return;
  }

  $("modalContent").innerHTML = html;
  $("modal").classList.remove("hidden");
}


function closeModal() {

  if ($("modal")) {
    $("modal").classList.add("hidden");
  }
}


window.closeModal = closeModal;


/* =========================================================
   SEATS
   ========================================================= */

async function loadSeats() {

  const { data, error } = await supabaseClient
    .from("seats")
    .select("*")
    .order("hall")
    .order("seat_number");

  if (error) {

    console.error("Seats:", error);

    if ($("seatMap")) {

      $("seatMap").innerHTML = `
        <div class="info-card">
          <h3>Unable to load seats</h3>
          <p>${escapeHTML(error.message)}</p>
        </div>
      `;
    }

    return;
  }

  allSeats = data || [];

  renderSeats();
  updateSeatCounters();
}


function renderSeats() {

  const map = $("seatMap");

  if (!map) return;

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
          <span class="eyebrow">${escapeHTML(name)}</span>
          <h3>Seat Map</h3>
        </div>
      </div>

      <div class="seat-grid">

        ${seats.map(seat => {

          const status =
            seat.status || "available";

          const icon =
            status === "occupied"
              ? "🔴"
              : status === "reserved"
                ? "🟡"
                : "🟢";

          return `
            <button
              class="seat ${escapeHTML(status)}"
              onclick="selectSeat('${seat.id}')"
              ${status !== "available" ? "disabled" : ""}
            >

              <span>${icon}</span>

              <b>
                ${escapeHTML(seat.seat_number)}
              </b>

            </button>
          `;

        }).join("")}

      </div>
    </div>
  `;
}


function updateSeatCounters() {

  const available =
    allSeats.filter(
      seat => seat.status === "available"
    ).length;

  const occupied =
    allSeats.filter(
      seat => seat.status === "occupied"
    ).length;

  if ($("availableCount")) {
    $("availableCount").textContent =
      available;
  }

  if ($("insideCount")) {
    $("insideCount").textContent =
      occupied;
  }

  document.querySelectorAll(
    ".mini-stats div:first-child b"
  ).forEach(el => {

    el.textContent =
      allSeats.length;
  });
}


/* =========================================================
   SELECT SEAT
   ========================================================= */

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
        This seat is currently available.
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
      <strong>Hall:</strong>
      ${escapeHTML(seat.hall)}
    </p>

    <p>
      This seat is available.
    </p>

    <button
      class="btn btn-primary full"
      onclick="requestSeat('${seat.id}')"
    >
      Select This Seat
    </button>
  `);
};


/* =========================================================
   BOOK SEAT
   ========================================================= */

window.requestSeat = async function(seatId) {

  if (!currentUser) {

    openLogin();
    return;
  }

  showModal(`
    <h2>Booking Seat...</h2>
    <p>Please wait.</p>
  `);

  const { data, error } =
    await supabaseClient.rpc(
      "book_seat",
      {
        p_seat_id: seatId
      }
    );

  if (error) {

    console.error("Book seat:", error);

    showModal(`
      <h2>❌ Seat Booking Failed</h2>

      <p>
        ${escapeHTML(error.message)}
      </p>

      <button
        class="btn btn-outline full"
        onclick="closeModal()"
      >
        Close
      </button>
    `);

    return;
  }

  showModal(`
    <h2>✅ Seat Reserved</h2>

    <p>
      Your seat has been reserved successfully.
    </p>

    <button
      class="btn btn-primary full"
      onclick="closeModal()"
    >
      Done
    </button>
  `);

  await loadSeats();
};


/* =========================================================
   AUTH - CURRENT USER
   ========================================================= */

async function loadCurrentUser() {

  const {
    data: { user }
  } = await supabaseClient.auth.getUser();

  currentUser =
    user || null;

  if (currentUser) {

    await loadProfile();

  } else {

    currentProfile = null;

    updateDashboard();
  }
}


/* =========================================================
   PROFILE
   ========================================================= */

async function loadProfile() {

  if (!currentUser) return;

  const { data, error } =
    await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .maybeSingle();

  if (error) {

    console.error(
      "Profile:",
      error
    );

    return;
  }

  currentProfile =
    data || null;

  updateDashboard();

  await loadMembership();
  await loadAttendance();
}


/* =========================================================
   DASHBOARD
   ========================================================= */

function updateDashboard() {

  if (!$("studentName")) return;

  if (!currentUser) {

    $("studentName").textContent =
      "Student";

    if ($("studentId")) {
      $("studentId").textContent =
        "ID: —";
    }

    if ($("studentSeat")) {
      $("studentSeat").textContent =
        "—";
    }

    if ($("studentPlan")) {
      $("studentPlan").textContent =
        "—";
    }

    if ($("studentValidity")) {
      $("studentValidity").textContent =
        "—";
    }

    if ($("paymentStatus")) {
      $("paymentStatus").textContent =
        "—";
    }

    if ($("studyTime")) {
      $("studyTime").textContent =
        "0h 0m";
    }

    if ($("liveBadge")) {
      $("liveBadge").textContent =
        "Logged out";
    }

    if ($("checkBtn")) {
      $("checkBtn").textContent =
        "Login to Check In";
    }

    return;
  }

  $("studentName").textContent =
    currentProfile?.full_name ||
    currentUser.email ||
    "Student";

  if ($("studentId")) {

    $("studentId").textContent =
      `ID: ${currentProfile?.student_id || "—"}`;
  }

  if ($("liveBadge")) {

    $("liveBadge").textContent =
      "Logged in";
  }

  if ($("checkBtn")) {

    $("checkBtn").textContent =
      "Check In / Check Out";
  }
}


/* =========================================================
   LOGIN
   ========================================================= */

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

  const form =
    $("loginForm");

  if (form) {

    form.addEventListener(
      "submit",
      loginStudent
    );
  }
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


/* =========================================================
   SIGNUP
   ========================================================= */

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

  const form =
    $("signupForm");

  if (form) {

    form.addEventListener(
      "submit",
      signupStudent
    );
  }
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

      password,

      options: {
        data: {
          full_name: name,
          student_id: studentId
        }
      }

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

  $("authMessage").textContent =
    data.session
      ? "Account created successfully."
      : "Account created. Please check your email to confirm your account.";

  setTimeout(() => {

    openLogin();

  }, 1500);
}


/* =========================================================
   MEMBERSHIP
   ========================================================= */

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

    console.error(
      "Membership:",
      error
    );

    return;
  }

  if (!data) return;

  if ($("studentPlan")) {

    $("studentPlan").textContent =
      data.plan || "—";
  }

  if ($("studentValidity")) {

    $("studentValidity").textContent =
      data.end_date || "—";
  }

  if ($("paymentStatus")) {

    $("paymentStatus").textContent =
      data.payment_status || "—";
  }
}


/* =========================================================
   ATTENDANCE
   ========================================================= */

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

    console.error(
      "Attendance:",
      error
    );

    return;
  }

  let totalSeconds = 0;

  (data || []).forEach(record => {

    if (!record.check_in) {
      return;
    }

    if (
      record.duration_seconds !== null &&
      record.duration_seconds !== undefined
    ) {

      totalSeconds +=
        Number(record.duration_seconds);

      return;
    }

    if (!record.check_out) {
      return;
    }

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
    Math.floor(
      totalSeconds / 3600
    );

  const minutes =
    Math.floor(
      (totalSeconds % 3600) / 60
    );

  if ($("studyTime")) {

    $("studyTime").textContent =
      `${hours}h ${minutes}m`;
  }
}


/* =========================================================
   FIND CURRENT ATTENDANCE
   ========================================================= */

async function getOpenAttendance() {

  if (!currentUser) {
    return null;
  }

  const { data, error } =
    await supabaseClient
      .from("attendance")
      .select("*")
      .eq("student_id", currentUser.id)
      .is("check_out", null)
      .maybeSingle();

  if (error) {

    console.error(
      "Open attendance:",
      error
    );

    return null;
  }

  return data || null;
}


/* =========================================================
   CHECK BUTTON
   ========================================================= */

async function handleCheckButton() {

  if (!currentUser) {

    openLogin();

    return;
  }

  const record =
    await getOpenAttendance();

  if (record) {

    await checkoutStudent();

  } else {

    await checkinStudent();
  }
}


/* =========================================================
   SECURE CHECK IN
   ========================================================= */

async function checkinStudent() {

  showModal(`
    <h2>Checking In...</h2>
    <p>Please wait.</p>
  `);

  const { data, error } =
    await supabaseClient.rpc(
      "check_in_student"
    );

  if (error) {

    console.error(
      "Check-in:",
      error
    );

    showModal(`
      <h2>❌ Check-in Failed</h2>

      <p>
        ${escapeHTML(error.message)}
      </p>

      <button
        class="btn btn-outline full"
        onclick="closeModal()"
      >
        Close
      </button>
    `);

    return;
  }

  showModal(`
    <h2>✅ Checked In</h2>

    <p>
      Your study session has started.
    </p>

    <p>
      <strong>Seat is now occupied.</strong>
    </p>

    <button
      class="btn btn-primary full"
      onclick="closeModal()"
    >
      Done
    </button>
  `);

  await loadSeats();
  await loadAttendance();
}


/* =========================================================
   SECURE CHECK OUT
   ========================================================= */

async function checkoutStudent() {

  showModal(`
    <h2>Checking Out...</h2>
    <p>Please wait.</p>
  `);

  const { data, error } =
    await supabaseClient.rpc(
      "check_out_student"
    );

  if (error) {

    console.error(
      "Check-out:",
      error
    );

    showModal(`
      <h2>❌ Check-out Failed</h2>

      <p>
        ${escapeHTML(error.message)}
      </p>

      <button
        class="btn btn-outline full"
        onclick="closeModal()"
      >
        Close
      </button>
    `);

    return;
  }

  let durationText = "";

  if (
    data &&
    data.duration_seconds !== null &&
    data.duration_seconds !== undefined
  ) {

    const seconds =
      Number(data.duration_seconds);

    const hours =
      Math.floor(seconds / 3600);

    const minutes =
      Math.floor(
        (seconds % 3600) / 60
      );

    durationText =
      `${hours}h ${minutes}m`;
  }

  showModal(`
    <h2>✅ Checked Out</h2>

    <p>
      Your study session has ended.
    </p>

    ${
      durationText
        ? `<p><strong>Session time: ${durationText}</strong></p>`
        : ""
    }

    <p>
      Your seat is now available.
    </p>

    <button
      class="btn btn-primary full"
      onclick="closeModal()"
    >
      Done
    </button>
  `);

  await loadSeats();
  await loadAttendance();
}


/* =========================================================
   NOTICES
   ========================================================= */

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

    console.error(
      "Notices:",
      error
    );

    return;
  }

  if (!data || !data.length) {

    if ($("noticeList")) {

      $("noticeList").innerHTML = `
        <div class="info-card">

          <h3>No notices</h3>

          <p>
            No library notices have been published.
          </p>

        </div>
      `;
    }

    return;
  }

  if ($("noticeList")) {

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
}


/* =========================================================
   QR
   ========================================================= */

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
      After login, the system will automatically
      determine whether you need to check in or
      check out.
    </p>

    <button
      class="btn btn-outline full"
      onclick="closeModal()"
    >
      Close
    </button>
  `);
}


window.openQR = openQR;


/* =========================================================
   PLANS
   ========================================================= */

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


/* =========================================================
   REALTIME
   ========================================================= */

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

        loadSea
