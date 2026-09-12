(() => {
  'use strict';

  // This version is compatible with the current demo UI.
  // Keep index.html, app.js, config.js and style.css in the same folder.

  const H1 = [
    'A1','A2','A3','A4','A5',
    'B1','B2','B3','B4','B5',
    'C1','C2','C3','C4','C5',
    'D1','D2','D3','D4','D5',
    'E1','E2','E3','E4','E5',
    'F1','F2','F3','F4','F5'
  ];

  const H2 = Array.from(
    { length: 40 },
    (_, i) => String(i + 1)
  );

  const demo = {
    occupied: new Set(['A3', 'B2', '12', '27']),
    reserved: new Set(['A5', '19']),

    student: {
      name: 'Demo Student',
      id: 'SPL001',
      seat: 'A3',
      plan: 'Hall 1 Full Time',
      validity: '15 Oct 2026',
      payment: 'PAID',
      inside: false,
      checkin: null,
      total: 0
    }
  };

  let supabaseClient = null;

  // --------------------------------
  // Helper
  // --------------------------------

  function $(selector) {
    return document.querySelector(selector);
  }

  // --------------------------------
  // Supabase initialization
  // --------------------------------

  function safeConfig() {
    const config = window.SPL_CONFIG || {};

    const url =
      typeof config.SUPABASE_URL === 'string'
        ? config.SUPABASE_URL
        : '';

    const key =
      typeof config.SUPABASE_KEY === 'string'
        ? config.SUPABASE_KEY
        : '';

    if (
      window.supabase &&
      url.startsWith('http') &&
      key
    ) {
      try {
        supabaseClient =
          window.supabase.createClient(url, key);
      } catch (error) {
        console.warn(
          'Supabase could not be initialized:',
          error
        );
      }
    }
  }

  // --------------------------------
  // Modal
  // --------------------------------

  function openModal(content) {
    const modal = $('#modal');
    const contentBox = $('#modalContent');

    if (!modal || !contentBox) {
      return;
    }

    contentBox.innerHTML = content;

    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
  }

  window.closeModal = function () {
    const modal = $('#modal');

    if (!modal) {
      return;
    }

    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  };

  // --------------------------------
  // Render seats
  // --------------------------------

  function renderSeats() {
    const seatMap = $('#seatMap');

    if (!seatMap) {
      return;
    }

    let html = '';

    const halls = [
      ['Hall 1 · Full Time · A1–F5', H1],
      ['Hall 2 · Seats 1–40', H2]
    ];

    halls.forEach(([title, seats]) => {

      html += `
        <div class="seat-hall">
          <h3>${title}</h3>
          <div class="seat-grid">
      `;

      seats.forEach(seat => {

        let status = 'available';

        if (
          demo.student.inside &&
          seat === demo.student.seat
        ) {
          status = 'occupied';

        } else if (demo.occupied.has(seat)) {
          status = 'occupied';

        } else if (demo.reserved.has(seat)) {
          status = 'reserved';
        }

        const label =
          status === 'occupied'
            ? 'Occupied'
            : status === 'reserved'
              ? 'Reserved'
              : 'Available';

        const you =
          status === 'occupied' &&
          seat === demo.student.seat
            ? '🟢 YOU'
            : label;

        html += `
          <button
            type="button"
            class="seat ${status}"
            onclick="seatAction('${seat}', '${status}')"
          >
            ${seat}
            <small>${you}</small>
          </button>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    seatMap.innerHTML = html;

    const totalSeats =
      H1.length + H2.length;

    const available =
      totalSeats -
      demo.occupied.size -
      demo.reserved.size;

    if ($('#availableCount')) {
      $('#availableCount').textContent =
        Math.max(0, available);
    }

    if ($('#insideCount')) {
      $('#insideCount').textContent =
        demo.student.inside ? '1' : '0';
    }
  }

  // --------------------------------
  // Seat selection
  // --------------------------------

  window.seatAction = function (seat, status) {

    if (status !== 'available') {

      openModal(`
        <h2>Seat ${seat}</h2>

        <p>
          This seat is ${status}.
          ${
            status === 'occupied'
              ? 'It is currently in use.'
              : 'It is reserved.'
          }
        </p>
      `);

      return;
    }

    openModal(`
      <h2>Book seat ${seat}</h2>

      <p>
        This demo seat is available.
        In production, your Supabase account
        will be checked before booking.
      </p>

      <button
        class="btn btn-primary full"
        type="button"
        onclick="bookSeat('${seat}')"
      >
        Confirm Seat
      </button>
    `);
  };

  // --------------------------------
  // Book seat
  // --------------------------------

  window.bookSeat = function (seat) {

    // Remove the student's previous demo seat.
    if (
      demo.student.seat &&
      demo.student.seat !== '—'
    ) {
      demo.occupied.delete(
        demo.student.seat
      );
    }

    demo.student.seat = seat;

    demo.reserved.delete(seat);

    demo.occupied.add(seat);

    window.closeModal();

    updateStudent();
    renderSeats();

    alert(
      `Seat ${seat} selected for the demo account.`
    );
  };

  // --------------------------------
  // Student information
  // --------------------------------

  function updateStudent() {

    const student = demo.student;

    if ($('#studentName')) {
      $('#studentName').textContent =
        student.name;
    }

    if ($('#studentId')) {
      $('#studentId').textContent =
        'ID: ' + student.id;
    }

    if ($('#studentSeat')) {
      $('#studentSeat').textContent =
        student.seat;
    }

    if ($('#studentPlan')) {
      $('#studentPlan').textContent =
        student.plan;
    }

    if ($('#studentValidity')) {
      $('#studentValidity').textContent =
        student.validity;
    }

    if ($('#paymentStatus')) {
      $('#paymentStatus').textContent =
        student.payment;
    }

    if ($('#liveBadge')) {
      $('#liveBadge').textContent =
        student.inside
          ? '🟢 In Library'
          : '⚪ Checked Out';
    }

    const checkBtn = $('#checkBtn');

    if (checkBtn) {

      checkBtn.textContent =
        student.inside
          ? 'CHECK OUT'
          : 'CHECK IN';

      checkBtn.onclick =
        toggleAttendance;
    }

    if ($('#studyTime')) {
      $('#studyTime').textContent =
        formatStudy();
    }
  }

  // --------------------------------
  // Study time
  // --------------------------------

  function formatStudy() {

    let ms =
      Number(demo.student.total) || 0;

    if (
      demo.student.inside &&
      demo.student.checkin
    ) {
      ms +=
        Date.now() -
        demo.student.checkin;
    }

    const minutes =
      Math.floor(ms / 60000);

    return `
      ${Math.floor(minutes / 60)}h
      ${minutes % 60}m
    `;
  }

  // --------------------------------
  // Check In / Check Out
  // --------------------------------

  function toggleAttendance() {

    if (!demo.student.inside) {

      if (
        !demo.student.seat ||
        demo.student.seat === '—'
      ) {
        alert(
          'Please select a seat first.'
        );

        return;
      }

      demo.student.inside = true;

      demo.student.checkin =
        Date.now();

      demo.occupied.add(
        demo.student.seat
      );

    } else {

      demo.student.total +=
        Date.now() -
        demo.student.checkin;

      demo.student.inside = false;

      demo.student.checkin = null;

      demo.occupied.delete(
        demo.student.seat
      );
    }

    updateStudent();
    renderSeats();
  }

  // --------------------------------
  // QR
  // --------------------------------

  function showQR() {

    openModal(`
      <h2>
        Study Point Library — IN / OUT QR
      </h2>

      <p>
        Place the permanent QR at the
        library entrance. In the production
        version it should point to your
        portal URL.
      </p>

      <div
        class="qr-placeholder"
        style="margin:20px auto"
      >
        QR
      </div>

      <p>
        <b>Flow:</b>
        Scan → Login → Check In / Check Out
      </p>
    `);
  }

  // --------------------------------
  // Notices
  // --------------------------------

  function notices() {

    const list =
      $('#noticeList');

    if (!list) {
      return;
    }

    const items = [

      [
        'Welcome to Study Point Library',
        'Maintain silence and use your assigned seat.'
      ],

      [
        'Membership renewal',
        'Renew before your validity ends to keep your seat.'
      ],

      [
        'QR attendance',
        'Use the single entrance QR for both IN and OUT.'
      ]

    ];

    list.innerHTML =
      items
        .map(([title, text]) => `
          <div class="notice">
            <b>${title}</b>
            <span>${text}</span>
          </div>
        `)
        .join('');
  }

  // --------------------------------
  // Membership plans
  // --------------------------------

  window.selectPlan = function (plan) {

    openModal(`
      <h2>${plan}</h2>

      <p>
        Your selection will be saved to
        your membership request in the
        production version.
      </p>

      <button
        class="btn btn-primary full"
        type="button"
        onclick="
          closeModal();
          alert('Membership request recorded in demo mode.')
        "
      >
        Continue
      </button>
    `);
  };

  // --------------------------------
  // Login
  // --------------------------------

  function login() {

    openModal(`
      <h2>Student Login</h2>

      <p>
        Production V2 will use Supabase Auth.
        For this starter, the demo student
        is already loaded.
      </p>

      <button
        class="btn btn-primary full"
        type="button"
        onclick="
          closeModal();
          updateStudentFromLogin()
        "
      >
        Continue as Demo Student
      </button>
    `);
  }

  window.updateStudentFromLogin =
    function () {
      updateStudent();
    };

  // --------------------------------
  // Initialize website
  // --------------------------------

  function init() {

    safeConfig();

    const loginBtn =
      $('#loginBtn');

    const qrBtn =
      $('#qrBtn');

    const qrBtn2 =
      $('#qrBtn2');

    if (loginBtn) {
      loginBtn.addEventListener(
        'click',
        login
      );
    }

    if (qrBtn) {
      qrBtn.addEventListener(
        'click',
        showQR
      );
    }

    if (qrBtn2) {
      qrBtn2.addEventListener(
        'click',
        showQR
      );
    }

    const year =
      $('#year');

    if (year) {
      year.textContent =
        new Date().getFullYear();
    }

    notices();

    updateStudent();

    renderSeats();

    // Update study time every 30 seconds.
    setInterval(() => {

      if ($('#studyTime')) {
        $('#studyTime').textContent =
          formatStudy();
      }

    }, 30000);

    // Close modal when clicking outside it.
    const modal =
      $('#modal');

    if (modal) {

      modal.addEventListener(
        'click',
        event => {

          if (
            event.target === modal
          ) {
            window.closeModal();
          }

        }
      );
    }

    // Close modal with Escape.
    document.addEventListener(
      'keydown',
      event => {

        if (event.key === 'Escape') {
          window.closeModal();
        }

      }
    );
  }

  // --------------------------------
  // Start app
  // --------------------------------

  if (
    document.readyState === 'loading'
  ) {

    document.addEventListener(
      'DOMContentLoaded',
      init,
      { once: true }
    );

  } else {

    init();

  }

})();
