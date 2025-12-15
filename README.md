## Responsive View

Responsive View is a Manifest V3 Chrome extension that provides a Polypane-style multi-viewport workflow for responsive design testing. Enter any URL from the popup and the extension opens a dedicated workspace tab that renders multiple device viewports side-by-side using mirrored tabs.

### Requirements

- [Bun 1.3+](https://bun.sh) (acts as runtime, package manager, and script runner)
- Chrome 121+ with Manifest V3 support enabled

### Scripts

```bash
# install dependencies (first run only)
bun install

# start dev server with HMR + auto reloading
bun dev

# type-check without emitting
bun typecheck

# create a production build in build/chrome-mv3-prod
bun build
```

After running `bun dev`, head to `chrome://extensions`, enable **Developer mode**, and load the folder under `build/chrome-mv3-dev`.

### Current surfaces

- **Popup (`popup.tsx`)**
  - Modern React 19 UI with device preset chips and URL validation (powered by Zod).
  - Remembers the last inspected URL + selection using `chrome.storage.sync`.
  - Stores the active session in `chrome.storage.session` and opens (or focuses) the workspace tab via `chrome.tabs`.
- **Workspace tab (`src/tabs/canvas.tsx`)**
  - Polypane-like grid UI with per-viewport reload + global scale slider.
  - Uses mirrored tabs + DevTools Protocol screenshots (via `chrome.debugger`) so it still works when sites block iframes.

### Controls

- Use the scale slider to zoom the workspace.
- Click/scroll inside a viewport to send basic pointer + wheel input to the mirrored tab.
- Use **Reload** per viewport or **Reload all**.

### Device profiles

`src/constants/devices.ts` defines both simple breakpoints (Mobile `360×800`, Tablet `768×1024`, Desktop `1920×1080`) and modern device presets (iPhone 16 Pro, Pixel 9 Pro, iPad Mini 6, Surface Pro 10, etc.) including DPR hints and UA strings. Update or expand this file to add more breakpoints or custom hardware profiles. `DEFAULT_DEVICE_IDS` controls which presets appear by default in the popup.

### Storage + messaging

- Long-lived session data lives in `chrome.storage.session` (`SESSION_STORAGE_KEY`).
- Last-used popup values live in `chrome.storage.sync` (`LAST_SESSION_KEY`), letting the extension sync across browsers that share the same Google profile.
- Mirror messages are defined in `src/types.ts` and flow over a `chrome.runtime.Port` from the workspace tab to the service worker.

### Implementation roadmap

1. **Better mirroring:** optimize screenshot cadence, reduce flicker, and add keyboard input + drag interactions.
2. **Side panel + DevTools hooks:** add `sidepanel.tsx` and `devtools.tsx` entry points in Plasmo to expose the same session controls without leaving the current tab.
3. **Custom device builder:** store a list of user-defined devices in `chrome.storage.sync`, plug into the popup chips, and offer import/export.
4. **Diagnostics overlays:** surface warnings when CSP/X-Frame headers block renders, show console errors per viewport, and expose screenshot capture for bug reports.

### Project layout

```
.
├── popup.tsx              # popup UI
├── src/tabs/canvas.tsx    # standalone canvas tab rendered as extension page
├── src/
│   ├── constants/         # device + storage keys
│   ├── types.ts
│   ├── utils/             # url + storage helpers
│   └── styles.css         # shared surface styles
└── assets/icon.png
```

### Known limitations

- Mirrored rendering uses `chrome.debugger`, which shows a prominent permission warning on install (expected for this kind of tool).
- Rendering is screenshot-based; fast animations/videos may appear choppy at the default capture cadence.
- Keyboard input forwarding is not implemented yet (pointer + wheel only).
- A minimized "preview" window is created to host the mirrored tabs; it should stay minimized and unfocused.

Feel free to iterate on any of these areas—the architecture keeps popup, canvas, and background concerns isolated so new entry points or APIs (tab capture, debugger, side panels) can be added incrementally.
