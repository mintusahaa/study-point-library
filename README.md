# Study Point Library V2

Real production architecture: GitHub Pages/static hosting + Supabase Auth/Postgres/Realtime.

## 1. GitHub
Create a repository named `study-point-library`, then upload all files/folders from this project. GitHub Pages can publish `index.html` from a repository.

## 2. Supabase
Create a project, open SQL Editor and run `database/schema.sql`.
Then create student/admin accounts in Authentication > Users. Add matching rows in `profiles`; set the owner's `role` to `admin`.

## 3. Connect frontend
Open `js/config.js` and replace:
- `YOUR_SUPABASE_URL`
- `YOUR_SUPABASE_PUBLISHABLE_KEY`

Use only the publishable/anon client key in browser code. Never expose a service-role secret.

## 4. Production work still required
The included frontend is a polished starter/demo and database schema. Before accepting real payments or student data, connect the login, seat booking, check-in/out and admin screens to Supabase queries and add the entrance QR URL. Do not use the demo data for real students.

## 5. Library details
- 8 AM–9 PM
- Hall 1 A1–F5: full-time ₹1,100/month
- Hall 2 1–40: full-time ₹1,100; 8 AM–2 PM ₹500; 2 PM–9 PM ₹600
- Locker: ₹200 refundable deposit, full-time only
- One QR for IN/OUT
- 
