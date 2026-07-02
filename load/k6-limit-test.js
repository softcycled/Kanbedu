// k6 limit-finding test for Kanbedu.
// Ramps to 500, holds, then pushes to 750 and 1000 to find the breaking point.
// Thresholds are relaxed so the test keeps running even when things degrade.
//
// Usage:
//   k6 run -e BASE_URL=https://your-preview.vercel.app \
//          -e TEST_EMAIL=loadtest@example.com \
//          -e TEST_PASSWORD=secret123 \
//          load/k6-limit-test.js

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";
import { envConfig, login, headersFor } from "./k6-common.js";

const { BASE_URL, EMAIL, PASSWORD } = envConfig();

const boardsLatency = new Trend("boards_latency", true);
const notesLatency = new Trend("notes_latency", true);

export const options = {
  stages: [
    { duration: "30s", target: 100 },
    { duration: "1m",  target: 500 },
    { duration: "2m",  target: 500 },
    { duration: "1m",  target: 750 },
    { duration: "2m",  target: 750 },
    { duration: "1m",  target: 1000 },
    { duration: "2m",  target: 1000 },
    { duration: "30s", target: 0 },
  ],
  // Relaxed thresholds — we want data at every stage, not an early abort.
  thresholds: {
    http_req_duration: ["p(95)<5000"],
    http_req_failed:   ["rate<0.20"],
  },
};

export function setup() {
  return login(BASE_URL, EMAIL, PASSWORD);
}

export default function (data) {
  const headers = headersFor(data.sessionCookie, BASE_URL);

  const boards = http.get(`${BASE_URL}/api/boards`, { headers });
  boardsLatency.add(boards.timings.duration);
  check(boards, { "boards 200": (r) => r.status === 200 });

  const notes = http.get(`${BASE_URL}/api/notifications`, { headers });
  notesLatency.add(notes.timings.duration);
  check(notes, { "notifications 200": (r) => r.status === 200 });

  sleep(1);
}
