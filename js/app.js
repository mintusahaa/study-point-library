/* Study Point Library V2
   Supabase-connected frontend
   Compatible with current index.html + schema.sql
*/

(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);

  let supabaseClient = null;
  let currentUser = null;
  let currentProfile = null;
  let currentSeats = [];
  let currentOpenAttendance = null;
  let realtimeChannels = [];

  const PLAN_LABELS = {
    hall1_full: "Hall 1 Full Time",
    hall2_full: "Hall 2 Full Time",
    hall2_morning: "Hall 2 Morning",
    hall2_evening: "Hall 2 Evening"
  };

  const PLAN_DETAILS = {
    "Hall 1 Full Time":
      "₹1,100/month · 8 AM–9 PM · Hall 1 · A1–F5",

    "Hall 2 Full Time":
      "₹1,100/month · 8 AM–9 PM · Hall 2 · Seats 1–40",

    "Hall 2 Morning":
      "₹500/month · 8 AM–2 PM · Hall 2 · Seats 1–40",

    "Hall 2 Evening":
      "₹600/month · 2 PM–9 PM · Hall 2 · Seats 1–40"
  };

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function planLabel(plan) {
    return PLAN_LABELS[plan] || plan || "—";
  }

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function formatDuration(seconds) {
    const totalMinutes = Math.max(
      0,
      Math.floor(Number(seconds || 0) / 60)
    );

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours}h ${minutes}m`;
  }

  function openModal(html) {
    const modal = $("#modal");
    const content = $("#modalContent");

    if (!modal || !content) return;

    content.innerHTML = html;
    modal.classList.remove("hidden");
  }

  window.closeModal = () => {
    $("#modal")?.classList.add("hidden");
  };

  function notify(message, title = "Study Point Library") {
    openModal(`
      <h2>${esc(title)}</h2>
      <p>${esc(message)}</p>

      <button
        class="btn btn-primary full"
        onclick="closeModal()">
        OK
      </button>
    `);
  }

  function showError(error, title = "Something went wrong") {
    console.error(title, error);

    const message =
      error?.message ||
      String(error || "Please try again.");

    notify(message, title);
  }

  function getConfig() {
    const config = window.SPL_CONFIG || {};

    return {
      url: String(config.SUPABASE_URL || ""),
      key: String(config.SUPABASE_KEY || "")
    };
  }

  function initSupabase() {
    const { url, key } = getConfig();

    if (
      !window.supabase ||
      !url.startsWith("http") ||
      !key
    ) {
      return false;
    }

    try {
      supabaseClient =
        window.supabase.createClient(url, key);

      return true;
    } catch (error) {
      console.error(
        "Supabase initialization error:",
        error
      );

      return false;
    }
  }

  async function getCurrentUser() {
    if (!supabaseClient) return null;

    const { data, error } =
      await supabaseClient.auth.getSession();

    if (error) throw error;

    return data.session?.user || null;
  }

  /* =========================
     PROFILE
  ========================= */

  async function loadProfile() {
    if (!currentUser) {
      currentProfile = null;
      return null;
    }

    const { data, error } =
      await supabaseClient
        .from("profiles")
        .select(
          "id,student_id,full_name,phone,role,created_at"
        )
        .eq("id", currentUser.id)
        .maybeSingle();

    if (error) throw error;

    currentProfile =
      data || {
        id: currentUser.id,
        student_id:
          currentUser.user_metadata?.student_id || "",
        full_name:
          currentUser.user_metadata?.full_name ||
          currentUser.email?.split("@")[0] ||
          "Student",
        phone:
          currentUser.user_metadata?.phone || "",
        role: "student"
      };

    return currentProfile;
  }

  /* =========================
     SEATS
  ========================= */

  async function loadSeats() {
    if (!supabaseClient || !currentUser) {
      currentSeats = [];
      renderLoggedOutSeats();
      updateAvailability();
      return;
    }

    const { data, error } =
      await supabaseClient
        .from("seats")
        .select(
          "id,hall,seat_number,plan_type,status,reserved_by"
        )
        .order("hall", {
          ascending: true
        })
        .order("seat_number", {
          ascending: true
        });

    if (error) {
      showError(error, "Could not load seats");
      return;
    }

    currentSeats = data || [];

    renderSeats();
    updateAvailability();
  }

  function updateAvailability() {
    const available =
      currentSeats.filter(
        (seat) => seat.status === "available"
      ).length;

    const occupied =
      currentSeats.filter(
        (seat) => seat.status === "occupied"
      ).length;

    if ($("#availableCount")) {
      $("#availableCount").textContent =
        currentSeats.length ? available : "—";
    }

    if ($("#insideCount")) {
      $("#insideCount").textContent = occupied;
    }
  }

  function renderLoggedOutSeats() {
    const map = $("#seatMap");

    if (!map) return;

    map.innerHTML = `
      <div class="info-card">

        <h3>Student Login Required</h3>

        <p>
          Login to see live seat availability
          and reserve your seat.
        </p>

        <button
          class="btn btn-primary"
          onclick="openLoginModal()">
          Student Login
        </button>

      </div>
    `;
  }

  function renderSeats() {
    const map = $("#seatMap");

    if (!map) return;

    if (!currentUser) {
      renderLoggedOutSeats();
      return;
    }

    const hall1 =
      currentSeats.filter(
        (seat) => seat.hall === "Hall 1"
      );

    const hall2 =
      currentSeats.filter(
        (seat) => seat.hall === "Hall 2"
      );

    let html = "";

    html += `
      <div class="seat-hall">

        <h3>
          Hall 1 · Full Time · A1–F5
        </h3>

        <div class="seat-grid">
    `;

    hall1.forEach((seat) => {
      html += createSeatButton(seat);
    });

    html += `
        </div>
      </div>
    `;

    html += `
      <div class="seat-hall">

        <h3>
          Hall 2 · Seats 1–40
        </h3>

        <div class="seat-grid">
    `;

    hall2.forEach((seat) => {
      html += createSeatButton(seat);
    });

    html += `
        </div>
      </div>
    `;

    map.innerHTML = html;
  }

  function createSeatButton(seat) {
    const status =
      seat.status || "available";

    const isMine =
      seat.reserved_by === currentUser?.id;

    let label = "Available";

    if (isMine) {
      label = "🟢 YOU";
    } else if (status === "occupied") {
      label = "Occupied";
    } else if (status === "reserved") {
      label = "Reserved";
    }

    return `
      <button
        class="seat ${esc(status)}"
        onclick="seatAction('${esc(seat.id)}')">

        ${esc(seat.seat_number)}

        <small>
          ${esc(label)}
        </small>

      </button>
    `;
  }

  window.seatAction = async (seatId) => {
    if (!currentUser) {
      openLoginModal(
        "Please login first to reserve a seat."
      );
      return;
    }

    const seat =
      currentSeats.find(
        (item) => item.id === seatId
      );

    if (!seat) {
      notify(
        "Seat not found. Please refresh the page."
      );
      return;
    }

    if (seat.status !== "available") {
      if (
        seat.reserved_by === currentUser.id
      ) {
        notify(
          `Seat ${seat.seat_number} is already reserved for your account.`
        );
      } else {
        notify(
          `Seat ${seat.seat_number} is currently ${seat.status}.`
        );
      }

      return;
    }

    openModal(`
      <h2>
        Book Seat ${esc(seat.seat_number)}
      </h2>

      <p>
        ${esc(seat.hall)}
      </p>

      <p>
        Are you sure you want to reserve
        this seat?
      </p>

      <button
        class="btn btn-primary full"
        onclick="bookSeat('${esc(seat.id)}')">

        Confirm Seat

      </button>
    `);
  };

  window.bookSeat = async (seatId) => {
    if (!currentUser) {
      openLoginModal(
        "Please login before booking a seat."
      );
      return;
    }

    try {
      const { error } =
        await supabaseClient.rpc(
          "book_seat",
          {
            p_seat_id: seatId
          }
        );

      if (error) throw error;

      closeModal();

      await loadSeats();
      await loadStudentDashboard();

      notify(
        "Your seat has been reserved successfully.",
        "Seat Reserved"
      );

    } catch (error) {
      showError(
        error,
        "Seat booking failed"
      );

      await loadSeats();
    }
  };

  /* =========================
     MEMBERSHIP
  ========================= */

  async function loadMembership() {
    if (!currentUser) return null;

    const { data, error } =
      await supabaseClient
        .from("memberships")
        .select(
          "id,plan,start_date,end_date,amount,payment_status,locker,locker_deposit,created_at"
        )
        .eq(
          "student_id",
          currentUser.id
        )
        .order("created_at", {
          ascending: false
        })
        .limit(1)
        .maybeSingle();

    if (error) throw error;

    return data;
  }

  /* =========================
     ATTENDANCE
  ========================= */

  async function loadAttendance() {
    if (!currentUser) {
      currentOpenAttendance = null;
      return [];
    }

    const { data, error } =
      await supabaseClient
        .from("attendance")
        .select(
          "id,seat_id,check_in,check_out,duration_seconds,created_at"
        )
        .eq(
          "student_id",
          currentUser.id
        )
        .order("check_in", {
          ascending: false
        })
        .limit(100);

    if (error) throw error;

    const rows = data || [];

    currentOpenAttendance =
      rows.find(
        (row) => !row.check_out
      ) || null;

    return rows;
  }

  function getTodayStart() {
    const date = new Date();

    date.setHours(
      0,
      0,
      0,
      0
    );

    return date.getTime();
  }

  function getLiveStudySeconds() {
    if (
      !currentOpenAttendance?.check_in
    ) {
      return 0;
    }

    return Math.floor(
      (
        Date.now() -
        new Date(
          currentOpenAttendance.check_in
        ).getTime()
      ) / 1000
    );
  }

  /* =========================
     DASHBOARD
  ========================= */

  async function loadStudentDashboard() {
    if (!currentUser) {
      setLoggedOutDashboard();
      return;
    }

    try {
      const [
        profile,
        membership,
        attendance
      ] = await Promise.all([
        loadProfile(),
        loadMembership(),
        loadAttendance()
      ]);

      const mySeat =
        currentSeats.find(
          (seat) =>
            seat.reserved_by ===
            currentUser.id
        );

      if ($("#studentName")) {
        $("#studentName").textContent =
          profile?.full_name ||
          "Student";
      }

      if ($("#studentId")) {
        $("#studentId").textContent =
          "ID: " +
          (profile?.student_id ||
            "Not assigned");
      }

      if ($("#studentSeat")) {
        $("#studentSeat").textContent =
          mySeat?.seat_number || "—";
      }

      if ($("#studentPlan")) {
        $("#studentPlan").textContent =
          membership
            ? planLabel(
                membership.plan
              )
            : "—";
      }

      if ($("#studentValidity")) {
        $("#studentValidity").textContent =
          membership
            ? `${formatDate(
                membership.start_date
              )} – ${formatDate(
                membership.end_date
              )}`
            : "—";
      }

      if ($("#paymentStatus")) {
        $("#paymentStatus").textContent =
          membership?.payment_status
            ?.toUpperCase() || "—";
      }

      let totalSeconds = 0;

      const todayStart =
        getTodayStart();

      attendance.forEach((row) => {
        const checkIn =
          new Date(
            row.check_in
          ).getTime();

        if (checkIn < todayStart) {
          return;
        }

        if (row.check_out) {
          totalSeconds +=
            Number(
              row.duration_seconds ||
              0
            );
        } else {
          totalSeconds +=
            getLiveStudySeconds();
        }
      });

      if ($("#studyTime")) {
        $("#studyTime").textContent =
          formatDuration(
            totalSeconds
          );
      }

      if ($("#liveBadge")) {
        $("#liveBadge").textContent =
          currentOpenAttendance
            ? "🟢 In Library"
            : "⚪ Checked Out";
      }

      const checkButton =
        $("#checkBtn");

      if (checkButton) {
        checkButton.textContent =
          currentOpenAttendance
            ? "CHECK OUT"
            : "CHECK IN";

        checkButton.onclick =
          handleAttendance;
      }

      const avatar =
        document.querySelector(
          ".avatar"
        );

      if (avatar) {
        const name =
          profile?.full_name ||
          "Student";

        avatar.textContent =
          name
            .split(/\s+/)
            .slice(0, 2)
            .map(
              (word) => word[0]
            )
            .join("")
            .toUpperCase();
      }

    } catch (error) {
      showError(
        error,
        "Could not load your dashboard"
      );
    }
  }

  function setLoggedOutDashboard() {
    if ($("#studentName"))
      $("#studentName").textContent =
        "Student";

    if ($("#studentId"))
      $("#studentId").textContent =
        "ID: —";

    if ($("#studentSeat"))
      $("#studentSeat").textContent =
        "—";

    if ($("#studentPlan"))
      $("#studentPlan").textContent =
        "—";

    if ($("#studentValidity"))
      $("#studentValidity").textContent =
        "—";

    if ($("#paymentStatus"))
      $("#paymentStatus").textContent =
        "—";

    if ($("#studyTime"))
      $("#studyTime").textContent =
        "0h 0m";

    if ($("#liveBadge"))
      $("#liveBadge").textContent =
        "Logged out";

    const button =
      $("#checkBtn");

    if (button) {
      button.textContent =
        "Login to Check In";

      button.onclick =
        () => openLoginModal();
    }
  }

  async function handleAttendance() {
    if (!currentUser) {
      openLoginModal(
        "Login to use attendance."
      );
      return;
    }

    try {
      if (currentOpenAttendance) {

        const { error } =
          await supabaseClient.rpc(
            "check_out_student"
          );

        if (error) throw error;

        await loadSeats();
        await loadStudentDashboard();

        notify(
          "Check-out recorded. Your study time has been updated.",
          "Checked Out"
        );

      } else {

        const mySeat =
          currentSeats.find(
            (seat) =>
              seat.reserved_by ===
              currentUser.id
          );

        if (!mySeat) {
          notify(
            "Please reserve a seat first, then check in."
          );

          document
            .querySelector("#seats")
            ?.scrollIntoView({
              behavior: "smooth"
            });

          return;
        }

        const { error } =
          await supabaseClient.rpc(
            "check_in_student"
          );

        if (error) throw error;

        await loadSeats();
        await loadStudentDashboard();

        notify(
          `Check-in recorded for seat ${mySeat.seat_number}.`,
          "Checked In"
        );
      }

    } catch (error) {
      showError(
        error,
        "Attendance action failed"
      );
    }
  }

  /* =========================
     LOGIN
  ========================= */

  function openLoginModal(message = "") {

    openModal(`
      <h2>Student Login</h2>

      ${
        message
          ? `<p><b>${esc(message)}</b></p>`
          : ""
      }

      <form id="loginForm">

        <label>Email</label>

        <input
          id="loginEmail"
          type="email"
          required
          placeholder="your@email.com"
          style="
            width:100%;
            padding:12px;
            margin:6px 0 12px;
          "
        >

        <label>Password</label>

        <input
          id="loginPassword"
          type="password"
          required
          placeholder="Password"
          style="
            width:100%;
            padding:12px;
            margin:6px 0 16px;
          "
        >

        <button
          class="btn btn-primary full"
          type="submit">

          Login

        </button>

      </form>

      <p style="margin-top:14px">
        New student?
      </p>

      <button
        class="btn btn-outline full"
        onclick="openSignupModal()">

        Create Student Account

      </button>
    `);

    $("#loginForm")?.addEventListener(
      "submit",
      async (event) => {

        event.preventDefault();

        const email =
          $("#loginEmail")
            ?.value
            .trim();

        const password =
          $("#loginPassword")
            ?.value;

        try {

          const { error } =
            await supabaseClient.auth
              .signInWithPassword({
                email,
                password
              });

          if (error) throw error;

          closeModal();

          await afterAuthChange();

          notify(
            "Login successful.",
            "Welcome"
          );

        } catch (error) {

          showError(
            error,
            "Login failed"
          );
        }
      }
    );
  }

  window.openLoginModal =
    openLoginModal;

  /* =========================
     SIGN UP
  ========================= */

  window.openSignupModal =
    () => {

      openModal(`
        <h2>Create Student Account</h2>

        <form id="signupForm">

          <label>Full Name</label>

          <input
            id="signupName"
            type="text"
            required
            placeholder="Full name"
            style="
              width:100%;
              padding:12px;
              margin:6px 0 12px;
            "
          >

          <label>Student ID</label>

          <input
            id
