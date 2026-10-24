# Luwingu Rider

## Run it
1. Install Node.js (https://nodejs.org, version 18 or newer).
2. Open a terminal in this folder and run:  node server.js
   (Windows, to set your own admin password:  set ADMIN_PASSWORD=mypassword && node server.js)
3. Open http://localhost:3000. The terminal also prints a Wi-Fi address like http://192.168.1.20:3000.
   Anyone on the same Wi-Fi/hotspot can open that address on their phone.

Note: the passenger map loads from the internet (OpenStreetMap), so the laptop and phones need data/Wi-Fi with internet.

Fare: K10 per km, based on the road distance between the map pins (OpenStreetMap routing, needs internet; falls back to straight-line if unavailable). Change it with FARE_PER_KM, e.g.  FARE_PER_KM=12 node server.js

Payment: passengers choose Cash on arrival, Airtel Money, MTN MoMo or Zamtel Money. The app only RECORDS the choice (shown to driver and admin); it does not collect mobile money payments itself.
Admin: the Drivers table has a View trips button that shows that driver's trips on a map.

## Pages
- /          Passengers request a ride and watch its status
- /driver    Drivers register, log in, and accept ride requests
- /admin     Admin approves/rejects drivers and sees all rides (default password: admin123, CHANGE IT)

## Flow
Driver registers -> admin approves -> driver logs in -> passenger requests -> driver accepts -> driver marks complete.

Data is saved in data.json (back it up). To let people outside your Wi-Fi use it, host it on a server (Render, Railway, a VPS) or use a tunnel such as ngrok.

## Putting it online (e.g. Render)
1. Upload this folder to a GitHub repository (data.json is ignored by .gitignore).
2. On Render: New > Web Service > pick the repo. Build command: npm install   Start command: node server.js
3. Environment variables: ADMIN_PASSWORD=your-own-password
4. To keep data between restarts you need a paid plan with a Persistent Disk (e.g. mount path /data) and the variable DATA_DIR=/data
   Without a disk, drivers and rides are erased whenever the app restarts or redeploys.
