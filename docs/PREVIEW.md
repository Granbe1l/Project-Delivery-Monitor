# Viewing the running application

## Immediately available visual preview

- [Actual desktop dashboard](screenshots/overview-live-desktop.png)
- [Actual mobile dashboard](screenshots/overview-live-mobile.png)
- [Actual workflow view](screenshots/ci-live-desktop.png)

These were captured in Chromium from the running React application using the actual FastAPI/PostgreSQL observations. No response mocks or test data were used for these images. Data is time-stamped and scoped, not real-time.

## Interactive view in the cloud Desktop

In the Codex right side panel, choose **New tab (+) → Desktop** if available. Opening the viewer starts the on-demand desktop. Open Chrome there and type `http://localhost:5173` into its address bar. This address belongs to the cloud machine; opening it in a browser on your own computer targets your own computer instead.

The API is on port 8000. The frontend and API were started with `scripts/start.sh` and left running in this session. If a later task restores the environment, run this script from `/workspace/Project-Delivery-Monitor` again, then check `/health/ready` and the dashboard. Processes do not persist through environment snapshots.

The agent could verify the UI with automated Chromium but could not open or control the shared Desktop: neither `cua_repl.js` nor `open_in_codex` was offered. Runtime status reported `remote_desktop.enabled=true`, `state=unknown`; DISPLAY was unset and no Chrome CDP endpoint was listening. The Desktop viewer interaction above has therefore **not been verified by the agent** in this session.

Diagnostic environment ID: `ccarenv_b64_Y2NhcmVudl9mODAwNzhhY2E3NDg4MTkxYmVlYWU3ODNkMGZkMzQxMA`. No public preview URL or tunnel has been created, and cloud-environment publication does not itself publish this app to the Internet.

## Reproduce the UI checks

With the app running and real data synced, from `frontend/`:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e:live
```

The suite compares rendered values to the running API, exercises actual records and downloads, and refreshes the screenshots above. It expects all three projects to have collected data and Streamlit to have at least two observations. It never invokes GitHub sync itself or seeds fixture data.
